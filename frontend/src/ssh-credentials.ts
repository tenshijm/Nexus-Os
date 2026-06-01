import { storage } from "@/src/utils/storage";

export type SshCredentials = {
  host: string;
  port: string;
  username: string;
  password: string;
};

const SSH_META_KEY = "nexus.ssh.meta";
const SSH_PASSWORD_KEY = "nexus.ssh.password";

export const SSH_DEFAULTS: SshCredentials = {
  host: "192.168.12.177",
  port: "22",
  username: "nexus",
  password: "",
};

export async function loadSshCredentials(): Promise<SshCredentials> {
  const meta = await storage.getItem<Partial<SshCredentials>>(SSH_META_KEY, {});
  const password = await storage.secureGet<string>(SSH_PASSWORD_KEY, "");
  return {
    host: meta?.host?.trim() || SSH_DEFAULTS.host,
    port: String(meta?.port ?? SSH_DEFAULTS.port),
    username: meta?.username?.trim() || SSH_DEFAULTS.username,
    password: password || "",
  };
}

type SshChangeListener = () => void;
const sshChangeListeners = new Set<SshChangeListener>();

/** Subscribe to on-device SSH credential updates (CONFIG save ÔåÆ TERM reconnect). */
export function subscribeSshCredentialsChanged(listener: SshChangeListener): () => void {
  sshChangeListeners.add(listener);
  return () => sshChangeListeners.delete(listener);
}

function notifySshCredentialsChanged() {
  sshChangeListeners.forEach((fn) => fn());
}

export async function saveSshCredentials(creds: SshCredentials, opts?: { keepPassword?: boolean }) {
  await storage.setItem(SSH_META_KEY, {
    host: creds.host.trim(),
    port: String(creds.port || "22"),
    username: creds.username.trim(),
  });
  if (creds.password) {
    await storage.secureSet(SSH_PASSWORD_KEY, creds.password);
  } else if (!opts?.keepPassword) {
    await storage.secureRemove(SSH_PASSWORD_KEY);
  }
  notifySshCredentialsChanged();
}

export async function sshCredentialsConfigured(): Promise<boolean> {
  const c = await loadSshCredentials();
  return Boolean(c.host && c.username && c.password);
}
