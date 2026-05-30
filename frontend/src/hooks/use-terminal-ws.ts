import { useCallback, useEffect, useRef, useState } from "react";
import { WS_TERMINAL_URL } from "@/src/theme";

export type WsStatus = "connecting" | "open" | "closed" | "error";

export type TerminalWsResult = {
  output: string;
  exit_code?: number;
  source?: "sim" | "ssh";
  host?: string;
  timing_ms?: number;
  command?: string;
};

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useTerminalWs() {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [source, setSource] = useState<"sim" | "ssh">("sim");
  const [hostLabel, setHostLabel] = useState("nexus@raspberry-tenshi");
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(
    new Map<string, { resolve: (v: TerminalWsResult) => void; reject: (e: Error) => void }>(),
  );
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_TERMINAL_URL);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "connected") {
          if (msg.source === "ssh" || msg.source === "sim") setSource(msg.source);
          if (msg.host) setHostLabel(msg.host);
          return;
        }
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (msg.type === "result" && msg.id) {
          const pending = pendingRef.current.get(msg.id);
          if (pending) {
            pendingRef.current.delete(msg.id);
            pending.resolve(msg as TerminalWsResult);
          }
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onerror = () => setStatus("error");

    ws.onclose = () => {
      wsRef.current = null;
      setStatus("closed");
      pendingRef.current.forEach((p) => p.reject(new Error("websocket closed")));
      pendingRef.current.clear();
      if (!unmountedRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 2000);
      }
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const exec = useCallback(
    (command: string): Promise<TerminalWsResult> =>
      new Promise((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("not connected"));
          return;
        }
        const id = nextId();
        pendingRef.current.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, command }));
        setTimeout(() => {
          if (!pendingRef.current.has(id)) return;
          pendingRef.current.delete(id);
          reject(new Error("timeout"));
        }, 30000);
      }),
    [],
  );

  return { status, source, hostLabel, exec };
}
