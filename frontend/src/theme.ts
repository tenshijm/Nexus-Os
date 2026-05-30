/**
 * NEXUS OS Theme Constants
 */
export const COLORS = {
  black: "#050505",
  green: "#00FF88",
  greenDim: "#00FF8830",
  greenBorder: "rgba(0,255,136,0.22)",
  greenSoft: "rgba(0,255,136,0.08)",
  cyan: "#00D4FF",
  cyanDim: "#00D4FF40",
  red: "#FF4444",
  amber: "#FFB800",
  surface: "#0A0F0A",
  card: "#0D1410",
  textMuted: "rgba(0,255,136,0.55)",
  textDim: "rgba(255,255,255,0.45)",
  white: "#E8FFF4",
};

export const FONTS = {
  heading: "Orbitron_700Bold",
  headingRegular: "Orbitron_400Regular",
  mono: "ShareTechMono_400Regular",
  body: "Inter_400Regular",
  bodyBold: "Inter_700Bold",
};

export const RADIUS = 2;

export function formatUptime(secs: number): string {
  if (secs < 0) secs = 0;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function tempColor(t: number): string {
  if (t < 60) return COLORS.green;
  if (t < 75) return COLORS.amber;
  return COLORS.red;
}

const BACKEND_ORIGIN =
  process.env.EXPO_PUBLIC_BACKEND_URL || "http://192.168.12.177:8001";

export const API_BASE = `${BACKEND_ORIGIN}/api`;

/** WebSocket terminal — persistent channel, no OkHttp POST stall on Android LAN. */
export const WS_TERMINAL_URL = `${BACKEND_ORIGIN.replace(/^https/i, "wss").replace(/^http/i, "ws")}/ws/terminal`;
