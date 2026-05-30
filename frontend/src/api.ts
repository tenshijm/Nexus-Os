import { API_BASE } from "./theme";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export const api = {
  info: () => req<any>("/nexus/info"),
  system: () => req<any>("/system"),
  docker: () => req<any[]>("/docker"),
  dockerStart: (id: string) => req(`/docker/start/${id}`, { method: "POST" }),
  dockerStop: (id: string) => req(`/docker/stop/${id}`, { method: "POST" }),
  dockerRestart: (id: string) => req(`/docker/restart/${id}`, { method: "POST" }),
  dockerLogs: (id: string) => req<any>(`/docker/logs/${id}`),
  haDevices: () => req<any>("/homeassistant/devices"),
  haToggle: (eid: string) =>
    req(`/homeassistant/toggle/${encodeURIComponent(eid)}`, { method: "POST" }),
  models: () => req<any>("/ollama/models"),
  chat: (message: string, session_id?: string) =>
    req<any>("/ollama/chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id }),
    }),
  audioState: () => req<any>("/audio/state"),
  audioPlay: (url: string) =>
    req<any>("/audio/play", { method: "POST", body: JSON.stringify({ url }) }),
  audioStop: () => req<any>("/audio/stop", { method: "POST" }),
  audioVolume: (level: number) =>
    req<any>("/audio/volume", { method: "POST", body: JSON.stringify({ level }) }),
  audioTTS: (text: string) =>
    req<any>("/audio/tts", { method: "POST", body: JSON.stringify({ text }) }),
  network: () => req<any>("/network/scan"),
  logs: (limit = 20) => req<any[]>(`/logs?limit=${limit}`),
  logsClear: () => req<any>("/logs/clear", { method: "POST" }),
};
