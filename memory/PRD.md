# NEXUS OS — Product Requirements (v1.2.0)

## Vision
Tactical military sci-fi mobile control center for a Raspberry Pi home server (codename **RASPBERRY-TENSHI**, IP 192.168.12.177). Looks and feels like an operating system, not a normal dashboard.

## Platform
- **Frontend:** Expo (React Native) — bottom-tab navigation (8 tabs)
- **Backend:** FastAPI on port 8001 (all routes prefixed `/api`)
- **DB:** MongoDB (settings, logs, chat sessions)
- **AI Core:** Claude Sonnet 4.5 via `emergentintegrations` (Emergent LLM Key)
- **Real integrations (run from server side):**
  - Docker SDK against `/var/run/docker.sock`
  - Home Assistant REST API via long-lived token (configurable from app)
  - Ollama REST API (`/api/tags`)
  - **paramiko-based SSH terminal** that runs commands on the Pi (configurable from CONFIG tab)
  - `psutil` for live CPU / RAM / temperature / network telemetry

## Stability fixes (v1.2.0)
- Android Expo Go no longer hangs on the splash because Google Fonts blocked first paint. The root layout now only awaits icon fonts (with a 4-second safety timeout) and lets Orbitron / Share Tech Mono / Inter load in the background.

## Visual Identity
- Color palette: `nexus-black` `#050505`, `nexus-green` `#00FF88`, `nexus-cyan` `#00D4FF`, `nexus-red` `#FF4444`, `nexus-amber` `#FFB800`.
- Typography: **Orbitron** (headings), **Share Tech Mono** (data/terminal), **Inter** (body).
- 1px glowing green borders, sharp corners (≤2px), pulsing dots, scanline overlay, count-up animations, blinking cursor, tactical HUD aesthetic.

## Screens
1. **Boot Sequence** — typewriter intro with [ENTER NEXUS] entry button.
2. **Dashboard** — CPU/RAM/Temp/Network rings, Docker / HA / Ollama status, live log feed, 4 quick action buttons.
3. **Docker Mission Control** — container cards with START/STOP/RESTART/LOGS + fullscreen logs modal.
4. **Smart Home Grid** — 42 mock HA devices, filter chips (ALL/LIGHTS/SENSORS/SWITCHES/CAMERAS), inline toggles.
5. **AI Console** — Claude Sonnet 4.5 chat with quick command chips, transmitting indicator, clear button.
6. **Network Map** — SVG topology with central node + 7 satellites, animated dashed lines, node registry, details card.
7. **Audio Control** — now-playing card with play/pause/skip, volume slider, URL input, 4 presets, TTS section.
8. **Terminal** — black/green Share Tech Mono shell, suggestions, history prev/next, server-side simulated command execution.
9. **Settings (CONFIG)** — configure Hostname / Pi IP / HA URL / HA long-lived token (masked, eye-toggle) / Ollama URL / **SSH host, port, user, password** (write-only, masked, eye-toggle). SAVE / RELOAD / LIVE CONNECTIVITY PROBE (now 4 indicators including SSH). Persists in MongoDB (server) + AsyncStorage (device).

## Backend Endpoints
- `GET /health`, `GET /api/`, `GET /api/nexus/info`
- `GET /api/system` — psutil-driven real metrics
- `GET /api/docker`, `POST /api/docker/{start|stop|restart}/{id}`, `GET /api/docker/logs/{id}` — Docker SDK
- `GET /api/homeassistant/devices`, `POST /api/homeassistant/toggle/{entity_id}` — httpx + token
- `GET /api/ollama/models`, `POST /api/ollama/chat`
- `GET /api/audio/state`, `POST /api/audio/{play|stop|volume|tts}`
- `GET /api/network/scan` — derived from Docker + HA + central Pi node
- `GET /api/logs?limit=N`, `POST /api/logs/clear`
- `POST /api/terminal/exec` — auto-routes to **paramiko SSH** when credentials set, else simulated shell; response includes `source: 'ssh'|'sim'`, `host`, `exit_code`.
- `POST /api/terminal/ssh-test` — explicit SSH connectivity probe
- `GET /api/settings`, `POST /api/settings`, `GET /api/settings/test` (HA / Ollama / Docker / SSH)

## Deployment
`/app/docker-compose.yml` + `/app/backend/Dockerfile` + `/app/DEPLOY.md` ship a turn-key Pi deploy: `docker compose up -d --build` brings up Mongo + the API on port 8001, mounts `/var/run/docker.sock`, and reads optional env defaults that the CONFIG tab can override at runtime.
