# NEXUS OS — Deployment Guide (Raspberry Pi)

This stack runs the NEXUS OS backend (FastAPI + MongoDB) on your **RASPBERRY-TENSHI** Pi at `192.168.12.177`. The Expo mobile app then points its `EXPO_PUBLIC_BACKEND_URL` at the Pi and everything (Docker control, Home Assistant, Ollama, real SSH terminal, telemetry) goes live.

## Prerequisites on the Pi
- Docker + docker compose plugin installed (`curl -fsSL https://get.docker.com | sh`)
- The user running compose is in the `docker` group (or run with `sudo`)
- Port 8001 free on the Pi
- (Optional) Ollama running on the host at `:11434`

## 1 · Copy the project to the Pi
```bash
scp -r ./app pi@192.168.12.177:/home/pi/nexus-os
ssh pi@192.168.12.177
cd /home/pi/nexus-os
```

## 2 · Create `.env` next to `docker-compose.yml`
```env
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxxxxxx
HA_URL=http://192.168.12.177:8123
HA_TOKEN=eyJhbGciOiJIUzI1NiIs...                  # your long-lived HA token
OLLAMA_URL=http://host.docker.internal:11434
PI_IP=192.168.12.177
PI_HOSTNAME=RASPBERRY-TENSHI
SSH_HOST=192.168.12.177
SSH_PORT=22
SSH_USER=pi
SSH_PASSWORD=your-pi-password                     # used by the in-app TERM tab
```

> Note: any of these can be left blank and configured later from inside the app's **CONFIG** tab. Values entered there override the `.env` defaults (stored in Mongo).

## 3 · Build and start
```bash
docker compose up -d --build
docker compose logs -f nexus-api
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
nexus - INFO - NEXUS OS core online
```

## 4 · Verify from another machine on the LAN
```bash
curl http://192.168.12.177:8001/health
curl http://192.168.12.177:8001/api/docker          # real container list
curl http://192.168.12.177:8001/api/settings/test    # ha / ollama / docker / ssh all ok=true
```

## 5 · Point the mobile app at the Pi
Two options.

### A · Quick test via Expo Go on your phone
Edit `frontend/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.12.177:8001
```
Then in the project root:
```bash
cd frontend && yarn install && yarn start
```
Scan the QR with **Expo Go** on a phone on the same Wi-Fi.

### B · Standalone APK / IPA build (recommended)
On Emergent, click the **Publish** button (top-right of the editor). Provide your iOS / Android signing credentials. Emergent will produce installable binaries that bake in the `EXPO_PUBLIC_BACKEND_URL` you set above.

## 6 · CONFIG tab inside the app
After launch, open **CONFIG** and:
1. Confirm `HA Base URL`, `Ollama URL`, `Pi IP`, `Hostname`.
2. Tap **REPLACE TOKEN** if you want to rotate the HA token.
3. Fill in `SSH Host`, `SSH User`, `Port` and tap the password field — enter the Pi user's password, then **SAVE CONFIG**. Tap **[ TEST NOW ]** — all four indicators (HOME ASSISTANT / OLLAMA / DOCKER SOCKET / SSH SHELL) should turn green.
4. Open the **TERM** tab. The top status bar should read `LIVE SSH · pi@192.168.12.177:22`. Try `uptime`, `df -h`, `docker ps` — they execute directly on the Pi via paramiko.

## Stop / update
```bash
docker compose pull && docker compose up -d --build   # update
docker compose down                                    # stop everything
docker compose down -v                                 # stop + wipe Mongo state
```

## Security notes
- The SSH password is stored in plaintext inside MongoDB (single-tenant local app). If that's not acceptable, swap to key-based auth: drop your private key into the API container and switch `paramiko.connect(... key_filename=...)` instead of `password=`.
- The backend has no authentication of its own — expose it only on your LAN. Use Tailscale / WireGuard / a reverse-proxy with basic auth if you need to reach it from outside.
- `/var/run/docker.sock` is mounted into the container — anything that can talk to the API can control any Docker container on the Pi. Keep the port firewalled accordingly.
