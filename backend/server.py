"""NEXUS OS Backend - Tactical home infrastructure control center API."""
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import time
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

BOOT_TIME = time.time()

app = FastAPI(title="NEXUS OS API", version="1.0.0")
api_router = APIRouter(prefix="/api")


# ----------------------------- Models -----------------------------
class SystemMetrics(BaseModel):
    cpu: float
    ram_used: float
    ram_total: float
    temp: float
    net_up: float
    net_down: float
    uptime: int
    timestamp: str


class NexusInfo(BaseModel):
    hostname: str
    ip: str
    version: str
    uptime: int


class DockerContainer(BaseModel):
    id: str
    name: str
    image: str
    status: str  # running | stopped | restarting
    cpu: float
    ram_mb: float
    uptime: int


class HADevice(BaseModel):
    entity_id: str
    name: str
    type: str  # light | sensor | switch | camera | binary_sensor
    state: str
    value: Optional[str] = None
    unit: Optional[str] = None
    last_updated: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    timestamp: str


class AudioPlayRequest(BaseModel):
    url: str


class AudioVolumeRequest(BaseModel):
    level: int  # 0-100


class AudioTTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "default"


class LogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    level: str
    source: str
    message: str


class TerminalCommandRequest(BaseModel):
    command: str


# ----------------------------- Mock State -----------------------------
MOCK_CONTAINERS = [
    {"id": "c1", "name": "homeassistant", "image": "homeassistant/home-assistant:latest", "status": "running", "started": time.time() - 86400 * 3},
    {"id": "c2", "name": "ollama", "image": "ollama/ollama:latest", "status": "running", "started": time.time() - 86400 * 2},
    {"id": "c3", "name": "tailscale", "image": "tailscale/tailscale:latest", "status": "running", "started": time.time() - 86400 * 7},
    {"id": "c4", "name": "pihole", "image": "pihole/pihole:latest", "status": "stopped", "started": time.time() - 3600},
    {"id": "c5", "name": "nexus-api", "image": "nexus/api:1.0", "status": "running", "started": time.time() - 1800},
    {"id": "c6", "name": "portainer", "image": "portainer/portainer-ce:latest", "status": "running", "started": time.time() - 86400 * 5},
]

MOCK_HA_DEVICES = []

def _seed_ha_devices():
    if MOCK_HA_DEVICES:
        return
    lights = [
        ("light.living_room", "Living Room"), ("light.kitchen", "Kitchen"),
        ("light.bedroom", "Bedroom"), ("light.bathroom", "Bathroom"),
        ("light.hallway", "Hallway"), ("light.office", "Office"),
        ("light.garage", "Garage"), ("light.porch", "Porch"),
    ]
    for eid, name in lights:
        MOCK_HA_DEVICES.append({
            "entity_id": eid, "name": name, "type": "light",
            "state": random.choice(["on", "off"]),
            "value": None, "unit": None,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })
    sensors = [
        ("sensor.temp_living", "Temp Living", "21.5", "°C"),
        ("sensor.temp_outside", "Temp Outside", "14.2", "°C"),
        ("sensor.humidity_bath", "Humidity Bath", "62", "%"),
        ("sensor.humidity_bed", "Humidity Bedroom", "48", "%"),
        ("sensor.power_total", "Power Total", "847", "W"),
        ("sensor.power_kitchen", "Power Kitchen", "232", "W"),
        ("sensor.co2_office", "CO2 Office", "612", "ppm"),
        ("sensor.luminance_living", "Luminance Living", "284", "lx"),
        ("sensor.pressure_atm", "Atmospheric Pressure", "1013", "hPa"),
        ("sensor.wind_speed", "Wind Speed", "12.4", "km/h"),
        ("sensor.rain_24h", "Rain 24h", "2.1", "mm"),
        ("sensor.uv_index", "UV Index", "3", ""),
        ("binary_sensor.door_front", "Front Door", "off", None),
        ("binary_sensor.door_back", "Back Door", "off", None),
        ("binary_sensor.motion_hallway", "Motion Hallway", "on", None),
        ("binary_sensor.motion_garage", "Motion Garage", "off", None),
        ("binary_sensor.window_kitchen", "Window Kitchen", "off", None),
        ("binary_sensor.smoke_main", "Smoke Detector", "off", None),
    ]
    for eid, name, val, unit in sensors:
        kind = "binary_sensor" if "binary_sensor" in eid else "sensor"
        MOCK_HA_DEVICES.append({
            "entity_id": eid, "name": name, "type": kind,
            "state": val if kind == "binary_sensor" else "active",
            "value": val if kind == "sensor" else None,
            "unit": unit,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })
    switches = [
        ("switch.heater", "Heater"), ("switch.fan_office", "Fan Office"),
        ("switch.coffee", "Coffee Machine"), ("switch.tv_living", "TV Living"),
        ("switch.printer", "Printer"), ("switch.router", "Router"),
        ("switch.nas", "NAS"), ("switch.charger_ev", "EV Charger"),
        ("switch.pump_garden", "Garden Pump"), ("switch.alarm", "Alarm System"),
        ("switch.gate", "Main Gate"), ("switch.solar_invert", "Solar Inverter"),
    ]
    for eid, name in switches:
        MOCK_HA_DEVICES.append({
            "entity_id": eid, "name": name, "type": "switch",
            "state": random.choice(["on", "off"]),
            "value": None, "unit": None,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })
    cameras = [
        ("camera.front_door", "Front Door Cam"), ("camera.garage", "Garage Cam"),
        ("camera.backyard", "Backyard Cam"), ("camera.living_room", "Living Room Cam"),
    ]
    for eid, name in cameras:
        MOCK_HA_DEVICES.append({
            "entity_id": eid, "name": name, "type": "camera",
            "state": "recording",
            "value": None, "unit": None,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })


_seed_ha_devices()

AUDIO_STATE = {"playing": False, "track": None, "volume": 50, "position": 0, "duration": 0}


# ----------------------------- Routes -----------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "nexus-os", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/")
async def root():
    return {"message": "NEXUS OS API ONLINE", "version": "1.0.0"}


@api_router.get("/nexus/info", response_model=NexusInfo)
async def nexus_info():
    return NexusInfo(
        hostname="RASPBERRY-TENSHI",
        ip="192.168.12.177",
        version="1.0.0",
        uptime=int(time.time() - BOOT_TIME),
    )


@api_router.get("/system", response_model=SystemMetrics)
async def system_metrics():
    return SystemMetrics(
        cpu=round(random.uniform(15, 45), 1),
        ram_used=round(random.uniform(3.8, 5.2), 2),
        ram_total=8.0,
        temp=round(random.uniform(48, 62), 1),
        net_up=round(random.uniform(50, 400), 1),
        net_down=round(random.uniform(300, 2200), 1),
        uptime=int(time.time() - BOOT_TIME),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@api_router.get("/docker")
async def docker_list():
    out = []
    for c in MOCK_CONTAINERS:
        uptime = int(time.time() - c["started"]) if c["status"] == "running" else 0
        out.append({
            "id": c["id"],
            "name": c["name"],
            "image": c["image"],
            "status": c["status"],
            "cpu": round(random.uniform(0.2, 12.0), 1) if c["status"] == "running" else 0,
            "ram_mb": round(random.uniform(40, 380), 1) if c["status"] == "running" else 0,
            "uptime": uptime,
        })
    return out


@api_router.post("/docker/start/{cid}")
async def docker_start(cid: str):
    for c in MOCK_CONTAINERS:
        if c["id"] == cid:
            c["status"] = "running"
            c["started"] = time.time()
            await _log("info", "docker", f"Container {c['name']} started")
            return {"ok": True, "status": "running"}
    raise HTTPException(404, "Container not found")


@api_router.post("/docker/stop/{cid}")
async def docker_stop(cid: str):
    for c in MOCK_CONTAINERS:
        if c["id"] == cid:
            c["status"] = "stopped"
            await _log("warn", "docker", f"Container {c['name']} stopped")
            return {"ok": True, "status": "stopped"}
    raise HTTPException(404, "Container not found")


@api_router.post("/docker/restart/{cid}")
async def docker_restart(cid: str):
    for c in MOCK_CONTAINERS:
        if c["id"] == cid:
            c["status"] = "running"
            c["started"] = time.time()
            await _log("info", "docker", f"Container {c['name']} restarted")
            return {"ok": True, "status": "running"}
    raise HTTPException(404, "Container not found")


@api_router.get("/docker/logs/{cid}")
async def docker_logs(cid: str):
    target = next((c for c in MOCK_CONTAINERS if c["id"] == cid), None)
    if not target:
        raise HTTPException(404, "Container not found")
    lines = []
    now = datetime.now(timezone.utc)
    for i in range(100):
        ts = now.isoformat()
        levels = ["INFO", "DEBUG", "INFO", "INFO", "WARN", "INFO"]
        lvl = random.choice(levels)
        samples = [
            f"[{target['name']}] heartbeat OK",
            f"[{target['name']}] request handled in {random.randint(2, 280)}ms",
            f"[{target['name']}] connection from 192.168.12.{random.randint(2, 254)}",
            f"[{target['name']}] cache hit ratio {random.randint(60, 99)}%",
            f"[{target['name']}] auth token refreshed",
            f"[{target['name']}] worker pool size = {random.randint(2, 16)}",
        ]
        lines.append(f"{ts} {lvl} {random.choice(samples)}")
    return {"id": cid, "name": target["name"], "lines": lines}


@api_router.get("/homeassistant/devices")
async def ha_devices():
    counts = {"light": 0, "sensor": 0, "switch": 0, "camera": 0, "binary_sensor": 0}
    for d in MOCK_HA_DEVICES:
        counts[d["type"]] = counts.get(d["type"], 0) + 1
    return {
        "total": len(MOCK_HA_DEVICES),
        "counts": counts,
        "devices": MOCK_HA_DEVICES,
        "online": True,
    }


@api_router.post("/homeassistant/toggle/{entity_id}")
async def ha_toggle(entity_id: str):
    for d in MOCK_HA_DEVICES:
        if d["entity_id"] == entity_id:
            if d["type"] not in ("light", "switch"):
                raise HTTPException(400, "Entity not toggleable")
            d["state"] = "off" if d["state"] == "on" else "on"
            d["last_updated"] = datetime.now(timezone.utc).isoformat()
            await _log("info", "ha", f"{entity_id} toggled to {d['state']}")
            return {"ok": True, "state": d["state"]}
    raise HTTPException(404, "Entity not found")


@api_router.get("/ollama/models")
async def ollama_models():
    return {
        "models": [
            {"name": "claude-sonnet-4.5", "parameters": "Anthropic", "context": 200000, "active": True},
            {"name": "claude-haiku-4.5", "parameters": "Anthropic", "context": 200000, "active": False},
            {"name": "gpt-5.4", "parameters": "OpenAI", "context": 128000, "active": False},
            {"name": "gemini-3.1-pro", "parameters": "Google", "context": 1000000, "active": False},
        ]
    }


NEXUS_SYSTEM_PROMPT = (
    "You are NEXUS, the tactical AI core of NEXUS OS — a military sci-fi home infrastructure "
    "operating system running on a Raspberry Pi codenamed RASPBERRY-TENSHI (192.168.12.177). "
    "You manage Docker containers, Home Assistant devices, audio output and network monitoring. "
    "Respond concisely in a calm, tactical operator tone. Use UPPERCASE for status keywords like "
    "ONLINE, OFFLINE, NOMINAL, WARNING, CRITICAL. Prefix actionable replies with '> '. "
    "Keep responses brief unless a detailed report is requested."
)


@api_router.post("/ollama/chat", response_model=ChatResponse)
async def ollama_chat(req: ChatRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    session_id = req.session_id or str(uuid.uuid4())
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=NEXUS_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(500, f"AI core error: {e}")

    ts = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": "user",
        "content": req.message,
        "timestamp": ts,
    })
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": "assistant",
        "content": reply,
        "timestamp": ts,
    })
    return ChatResponse(reply=reply, session_id=session_id, timestamp=ts)


@api_router.get("/audio/state")
async def audio_state():
    return AUDIO_STATE


@api_router.post("/audio/play")
async def audio_play(req: AudioPlayRequest):
    AUDIO_STATE["playing"] = True
    AUDIO_STATE["track"] = req.url
    AUDIO_STATE["position"] = 0
    AUDIO_STATE["duration"] = random.randint(120, 320)
    await _log("info", "audio", f"Playing {req.url}")
    return {"ok": True, "state": AUDIO_STATE}


@api_router.post("/audio/stop")
async def audio_stop():
    AUDIO_STATE["playing"] = False
    AUDIO_STATE["track"] = None
    await _log("info", "audio", "Playback stopped")
    return {"ok": True, "state": AUDIO_STATE}


@api_router.post("/audio/volume")
async def audio_volume(req: AudioVolumeRequest):
    level = max(0, min(100, req.level))
    AUDIO_STATE["volume"] = level
    return {"ok": True, "volume": level}


@api_router.post("/audio/tts")
async def audio_tts(req: AudioTTSRequest):
    await _log("info", "audio", f"TTS: {req.text[:60]}")
    return {"ok": True, "spoken": req.text, "voice": req.voice}


@api_router.get("/network/scan")
async def network_scan():
    devices = [
        {"id": "n1", "label": "RASPBERRY-TENSHI", "ip": "192.168.12.177", "mac": "DC:A6:32:AA:BB:CC", "online": True, "latency": 0, "central": True},
        {"id": "n2", "label": "Router", "ip": "192.168.12.1", "mac": "00:11:22:33:44:55", "online": True, "latency": 1},
        {"id": "n3", "label": "Desktop", "ip": "192.168.12.10", "mac": "00:1A:2B:3C:4D:5E", "online": True, "latency": 2},
        {"id": "n4", "label": "iPhone", "ip": "192.168.12.42", "mac": "F0:18:98:00:11:22", "online": True, "latency": 8},
        {"id": "n5", "label": "Smart TV", "ip": "192.168.12.55", "mac": "B8:27:EB:11:22:33", "online": True, "latency": 12},
        {"id": "n6", "label": "Printer", "ip": "192.168.12.88", "mac": "AC:DE:48:00:11:22", "online": False, "latency": 0},
        {"id": "n7", "label": "NAS", "ip": "192.168.12.99", "mac": "00:50:56:C0:00:08", "online": True, "latency": 3},
        {"id": "n8", "label": "Camera-Front", "ip": "192.168.12.150", "mac": "A4:DA:32:00:11:22", "online": True, "latency": 15},
    ]
    return {"central_id": "n1", "devices": devices, "bandwidth_mbps": round(random.uniform(85, 240), 1)}


@api_router.get("/logs")
async def logs_list(limit: int = 20):
    cursor = db.nexus_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return list(reversed(items))


@api_router.post("/logs/clear")
async def logs_clear():
    await db.nexus_logs.delete_many({})
    await _log("warn", "system", "Log buffer cleared")
    return {"ok": True}


@api_router.post("/terminal/exec")
async def terminal_exec(req: TerminalCommandRequest):
    cmd = (req.command or "").strip()
    out = _simulate_shell(cmd)
    return {"command": cmd, "output": out, "timestamp": datetime.now(timezone.utc).isoformat()}


def _simulate_shell(cmd: str) -> str:
    if not cmd:
        return ""
    parts = cmd.split()
    head = parts[0].lower()
    if head in ("help", "?"):
        return ("Available: help, uptime, whoami, hostname, ls, pwd, date, "
                "uname, ps, docker, free, df, ip, ping, clear, neofetch")
    if head == "uptime":
        secs = int(time.time() - BOOT_TIME)
        return f"up {secs // 3600}h {(secs % 3600) // 60}m, load average: 0.42 0.35 0.28"
    if head == "whoami":
        return "nexus"
    if head == "hostname":
        return "raspberry-tenshi"
    if head == "pwd":
        return "/home/nexus"
    if head == "date":
        return datetime.now(timezone.utc).strftime("%a %b %d %H:%M:%S UTC %Y")
    if head == "ls":
        return "Documents  Downloads  containers  nexus-os  logs  scripts"
    if head == "uname":
        return "Linux raspberry-tenshi 6.6.20 #1 SMP PREEMPT aarch64 GNU/Linux"
    if head == "free":
        return ("              total        used        free\n"
                "Mem:           8000        4521        3479\n"
                "Swap:          2048           0        2048")
    if head == "df":
        return ("Filesystem     Size  Used Avail Use% Mounted on\n"
                "/dev/mmcblk0p2 119G   42G   72G  37% /\n"
                "/dev/sda1      1.8T  632G  1.1T  37% /mnt/data")
    if head == "ps":
        return ("PID   CMD\n"
                "  1   /sbin/init\n"
                "421   nexus-api\n"
                "658   ollama serve\n"
                "812   homeassistant\n"
                "934   dockerd")
    if head == "docker":
        if len(parts) > 1 and parts[1] == "ps":
            return "\n".join([f"{c['id']}  {c['name']:<16}  {c['status']:<10}  {c['image']}" for c in MOCK_CONTAINERS])
        return "Usage: docker ps"
    if head == "ip":
        return "inet 192.168.12.177/24 brd 192.168.12.255 scope global wlan0"
    if head == "ping":
        target = parts[1] if len(parts) > 1 else "192.168.12.1"
        return (f"PING {target} 56 data bytes\n"
                f"64 bytes from {target}: icmp_seq=1 ttl=64 time=1.42 ms\n"
                f"64 bytes from {target}: icmp_seq=2 ttl=64 time=1.18 ms\n"
                f"--- {target} ping statistics ---\n"
                "2 packets transmitted, 2 received, 0% packet loss")
    if head == "neofetch":
        return ("nexus@raspberry-tenshi\n"
                "----------------------\n"
                "OS: NEXUS OS 1.0.0\n"
                "Host: Raspberry Pi 5\n"
                "Kernel: 6.6.20\n"
                "CPU: BCM2712 (4) @ 2.4GHz\n"
                "RAM: 4521MiB / 8000MiB")
    if head == "clear":
        return "__CLEAR__"
    return f"nexus-shell: command not found: {head}"


async def _log(level: str, source: str, message: str):
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "source": source,
        "message": message,
    }
    await db.nexus_logs.insert_one(entry.copy())
    # Trim collection to last 500
    count = await db.nexus_logs.count_documents({})
    if count > 500:
        old = await db.nexus_logs.find({}, {"_id": 1}).sort("timestamp", 1).limit(count - 500).to_list(length=count)
        if old:
            await db.nexus_logs.delete_many({"_id": {"$in": [o["_id"] for o in old]}})


# Register router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nexus")


@app.on_event("startup")
async def on_startup():
    await _log("info", "system", "NEXUS OS core online")
    await _log("info", "system", "Docker daemon connected")
    await _log("info", "system", "Home Assistant bridge ready")
    await _log("info", "system", "Ollama AI core: ONLINE")
    await _log("info", "system", "All systems nominal")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
