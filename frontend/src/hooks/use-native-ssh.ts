import { useCallback, useEffect, useSyncExternalStore } from "react";
import SSHClient, { type NativeSshClient } from "@/src/native-ssh";
import type { SshCredentials } from "@/src/ssh-credentials";

export type NativeSshStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const RECONNECT_MS = 2500;
const MAX_OUTPUT = 200_000;

type Listener = () => void;

function credsKey(c: SshCredentials): string {
  return `${c.host}|${c.port}|${c.username}|${c.password}`;
}

/** Module-level singleton ÔÇö survives tab unmount without tearing down SSH. */
const ssh = {
  client: null as NativeSshClient | null,
  creds: null as SshCredentials | null,
  listeners: new Set<Listener>(),
  reconnectTimer: null as ReturnType<typeof setTimeout> | null,
  connectGen: 0,
  connecting: false,
  status: "idle" as NativeSshStatus,
  output: "",
  error: null as string | null,
};

function notify() {
  ssh.listeners.forEach((fn) => fn());
}

function appendOutput(chunk: string) {
  if (!chunk) return;
  ssh.output =
    ssh.output.length + chunk.length > MAX_OUTPUT
      ? ssh.output.slice(-MAX_OUTPUT) + chunk
      : ssh.output + chunk;
  notify();
}

function clearReconnect() {
  if (ssh.reconnectTimer) {
    clearTimeout(ssh.reconnectTimer);
    ssh.reconnectTimer = null;
  }
}

async function teardownClient() {
  clearReconnect();
  const client = ssh.client;
  ssh.client = null;
  if (!client) return;
  try {
    await client.closeShell();
  } catch {
    /* ignore */
  }
  try {
    await client.disconnect();
  } catch {
    /* ignore */
  }
}

async function connectInternal(creds: SshCredentials, force = false): Promise<void> {
  if (!creds.host?.trim() || !creds.username?.trim() || !creds.password) {
    ssh.status = "error";
    ssh.error = "SSH credentials missing ÔÇö configure in CONFIG tab";
    notify();
    return;
  }

  if (
    !force &&
    ssh.status === "connected" &&
    ssh.creds &&
    credsKey(ssh.creds) === credsKey(creds)
  ) {
    return;
  }
  if (ssh.connecting) return;

  ssh.connecting = true;
  const gen = ++ssh.connectGen;
  clearReconnect();

  const prevStatus = ssh.status;
  ssh.status = prevStatus === "connected" ? "reconnecting" : "connecting";
  ssh.error = null;
  notify();

  await teardownClient();

  try {
    const port = parseInt(creds.port || "22", 10) || 22;
    const client = await SSHClient.connectWithPassword(
      creds.host.trim(),
      port,
      creds.username.trim(),
      creds.password,
    );

    if (gen !== ssh.connectGen) {
      try {
        await client.disconnect();
      } catch {
        /* stale connect */
      }
      return;
    }

    client.on("Shell", (data: string) => {
      if (data) appendOutput(typeof data === "string" ? data : String(data));
    });

    ssh.client = client;
    ssh.creds = creds;
    await client.startShell("xterm");

    if (gen !== ssh.connectGen) return;

    ssh.status = "connected";
    appendOutput(`\r\n[NEXUS] direct SSH ÔåÆ ${creds.username}@${creds.host}:${port}\r\n`);
  } catch (e: unknown) {
    if (gen !== ssh.connectGen) return;
    const msg = e instanceof Error ? e.message : String(e);
    ssh.status = "error";
    ssh.error = msg;
    appendOutput(`\r\n[NEXUS] connection failed: ${msg}\r\n`);
    ssh.reconnectTimer = setTimeout(() => {
      if (ssh.creds) connectInternal(ssh.creds, true);
    }, RECONNECT_MS);
  } finally {
    if (gen === ssh.connectGen) ssh.connecting = false;
    notify();
  }
}

export function useNativeSsh(creds: SshCredentials | null, enabled: boolean) {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      ssh.listeners.add(onStoreChange);
      return () => ssh.listeners.delete(onStoreChange);
    },
    () => ({
      status: ssh.status,
      output: ssh.output,
      error: ssh.error,
    }),
  );

  useEffect(() => {
    if (enabled && creds) {
      connectInternal(creds);
    }
    // Intentionally no teardown ÔÇö session persists across tab navigation.
  }, [enabled, creds?.host, creds?.port, creds?.username, creds?.password]);

  const connect = useCallback(() => {
    if (creds) return connectInternal(creds, true);
  }, [creds]);

  const disconnect = useCallback(async () => {
    ssh.connectGen += 1;
    clearReconnect();
    ssh.connecting = false;
    await teardownClient();
    ssh.status = "idle";
    ssh.creds = null;
    notify();
  }, []);

  const write = useCallback(async (data: string) => {
    const client = ssh.client;
    if (!client || ssh.status !== "connected") return false;
    try {
      await client.writeToShell(data);
      return true;
    } catch (e: unknown) {
      ssh.error = e instanceof Error ? e.message : String(e);
      ssh.status = "error";
      notify();
      ssh.reconnectTimer = setTimeout(() => {
        if (ssh.creds) connectInternal(ssh.creds, true);
      }, RECONNECT_MS);
      return false;
    }
  }, []);

  const sendCtrl = useCallback(
    (code: "C" | "Z") => write(code === "C" ? "\x03" : "\x1a"),
    [write],
  );

  const sendArrow = useCallback(
    (dir: "up" | "down") => write(dir === "up" ? "\x1b[A" : "\x1b[B"),
    [write],
  );

  const setOutput = useCallback((text: string | ((prev: string) => string)) => {
    ssh.output = typeof text === "function" ? text(ssh.output) : text;
    notify();
  }, []);

  return {
    ...snapshot,
    setOutput,
    connect,
    disconnect,
    write,
    sendCtrl,
    sendArrow,
  };
}
