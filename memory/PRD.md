# NEXUS OS — Product Requirements (v1.0.0)

## Vision
Tactical military sci-fi mobile control center for a Raspberry Pi home server (codename **RASPBERRY-TENSHI**, IP 192.168.12.177). Looks and feels like an operating system, not a normal dashboard.

## Platform
- **Frontend:** Expo (React Native) — bottom-tab navigation
- **Backend:** FastAPI on port 8001 (all routes prefixed `/api`)
- **DB:** MongoDB (logs, chat sessions)
- **AI Core:** Claude Sonnet 4.5 via `emergentintegrations` (Emergent LLM Key)

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

## Backend Endpoints
- `GET /health`, `GET /api/`, `GET /api/nexus/info`
- `GET /api/system`
- `GET /api/docker`, `POST /api/docker/{start|stop|restart}/{id}`, `GET /api/docker/logs/{id}`
- `GET /api/homeassistant/devices`, `POST /api/homeassistant/toggle/{entity_id}`
- `GET /api/ollama/models`, `POST /api/ollama/chat`
- `GET /api/audio/state`, `POST /api/audio/{play|stop|volume|tts}`
- `GET /api/network/scan`
- `GET /api/logs?limit=N`, `POST /api/logs/clear`
- `POST /api/terminal/exec`

## Mock Data Strategy
All Raspberry Pi resources are mocked server-side so endpoints are immediately demonstrable. The user can later swap in real Pi connectivity by replacing the mock state in `server.py`.
