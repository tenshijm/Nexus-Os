"""NEXUS OS Backend - Tactical home infrastructure control center API.

Real integrations:
- Docker via docker SDK (/var/run/docker.sock)
- Home Assistant via REST API + long-lived token
- Ollama via REST API
- Settings stored in MongoDB, configurable from the SETTINGS tab in the app.
"""
import json
import threading

from fastapi import FastAPI, APIRouter, HTTPException
from starlette.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
import asyncio
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone

import httpx
try:
    import docker as docker_lib
    from docker.errors import NotFound, APIError
except Exception:  # pragma: no cover
    docker_lib = None
    NotFound = Exception
    APIError = Exception

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Default seed values (overridable via /api/settings)
DEFAULT_SETTINGS = {
    "ha_url": os.environ.get("HA_URL", "http://192.168.12.177:8123"),
    "ha_token": os.environ.get("HA_TOKEN", ""),
    "ollama_url": os.environ.get("OLLAMA_URL", "http://localhost:11434"),
    "pi_ip": os.environ.get("PI_IP", "192.168.12.177"),
    "hostname": os.environ.get("PI_HOSTNAME", "RASPBERRY-TENSHI"),
    "ssh_host": os.environ.get("SSH_HOST", "192.168.12.177"),
    "ssh_port": int(os.environ.get("SSH_PORT", "22")),
    "ssh_user": os.environ.get("SSH_USER", "nexus"),
    "ssh_password": os.environ.get("SSH_PASSWORD", ""),
}

BOOT_TIME = time.time()

app = FastAPI(title="NEXUS OS API", version="1.1.0")
api_router = APIRouter(prefix="/api")

logger = logging.getLogger("nexus")


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


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model: Optional[str] = None  # ignored — we always route to Claude Sonnet 4.5


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    timestamp: str


class AudioPlayRequest(BaseModel):
    url: str


class AudioVolumeRequest(BaseModel):
    level: int


class AudioTTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "default"


class TerminalCommandRequest(BaseModel):
    command: str


class SettingsUpdate(BaseModel):
    ha_url: Optional[str] = None
    ha_token: Optional[str] = None
    ollama_url: Optional[str] = None
    pi_ip: Optional[str] = None
    hostname: Optional[str] = None
    ssh_host: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_user: Optional[str] = None
    ssh_password: Optional[str] = None


AUDIO_STATE: dict[str, Any] = {
    "playing": False,
    "track": None,
    "volume": 50,
    "position": 0,
    "duration": 0,
}


# ----------------------------- Settings store -----------------------------
async def get_settings() -> dict:
    doc = await db.nexus_settings.find_one({"_id": "singleton"}, {"_id": 0})
    if not doc:
        return dict(DEFAULT_SETTINGS)
    merged = {**DEFAULT_SETTINGS, **doc}
    return merged


async def save_settings(update: dict) -> dict:
    clean = {k: v for k, v in update.items() if v is not None}
    await db.nexus_settings.update_one(
        {"_id": "singleton"},
        {"$set": clean},
        upsert=True,
    )
    return await get_settings()


def public_settings(s: dict) -> dict:
    """Mask sensitive values when returning to clients."""
    out = dict(s)
    tok = out.pop("ha_token", "") or ""
    out["ha_token_set"] = bool(tok)
    out["ha_token_masked"] = (f"{tok[:6]}…{tok[-4:]}" if len(tok) > 10 else ("***" if tok else ""))
    pw = out.pop("ssh_password", "") or ""
    out["ssh_password_set"] = bool(pw)
    return out


# ----------------------------- Docker -----------------------------
def _docker_client():
    if docker_lib is None:
        raise HTTPException(503, "Docker SDK not installed on this host")
    try:
        return docker_lib.DockerClient(base_url="unix:///var/run/docker.sock")
    except Exception as e:
        raise HTTPException(503, f"Docker daemon unreachable: {e}")


def _serialize_container(c) -> dict:
    try:
        c.reload()
    except Exception:
        pass
    status = c.status  # running | exited | restarting | created | paused
    norm_status = {
        "running": "running",
        "restarting": "restarting",
    }.get(status, "stopped")
    started_at = c.attrs.get("State", {}).get("StartedAt", "")
    uptime = 0
    if started_at and norm_status == "running":
        try:
            dt = datetime.fromisoformat(started_at.replace("Z", "+00:00").split(".")[0] + "+00:00")
            uptime = int((datetime.now(timezone.utc) - dt).total_seconds())
        except Exception:
            uptime = 0
    cpu_pct = 0.0
    ram_mb = 0.0
    if norm_status == "running":
        try:
            stats = c.stats(stream=False)
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
            sys_delta = stats["cpu_stats"]["system_cpu_usage"] - stats["precpu_stats"]["system_cpu_usage"]
            ncpus = stats["cpu_stats"].get("online_cpus", 1)
            if sys_delta > 0:
                cpu_pct = (cpu_delta / sys_delta) * ncpus * 100.0
            ram_mb = stats["memory_stats"].get("usage", 0) / (1024 * 1024)
        except Exception:
            pass
    image = (c.image.tags[0] if c.image and c.image.tags else c.attrs.get("Config", {}).get("Image", "unknown"))
    return {
        "id": c.short_id,
        "name": c.name,
        "image": image,
        "status": norm_status,
        "cpu": round(cpu_pct, 1),
        "ram_mb": round(ram_mb, 1),
        "uptime": uptime,
    }


@api_router.get("/docker")
async def docker_list():
    try:
        cli = _docker_client()
        containers = await asyncio.to_thread(cli.containers.list, all=True)
        return [_serialize_container(c) for c in containers]
    except HTTPException:
        return []
    except Exception as e:
        logger.warning(f"docker list error: {e}")
        return []


def _get_container(cli, cid: str):
    try:
        return cli.containers.get(cid)
    except NotFound:
        raise HTTPException(404, "Container not found")


@api_router.post("/docker/start/{cid}")
async def docker_start(cid: str):
    cli = _docker_client()
    c = await asyncio.to_thread(_get_container, cli, cid)
    await asyncio.to_thread(c.start)
    await _log("info", "docker", f"Container {c.name} started")
    return {"ok": True, "status": "running"}


@api_router.post("/docker/stop/{cid}")
async def docker_stop(cid: str):
    cli = _docker_client()
    c = await asyncio.to_thread(_get_container, cli, cid)
    await asyncio.to_thread(c.stop)
    await _log("warn", "docker", f"Container {c.name} stopped")
    return {"ok": True, "status": "stopped"}


@api_router.post("/docker/restart/{cid}")
async def docker_restart(cid: str):
    cli = _docker_client()
    c = await asyncio.to_thread(_get_container, cli, cid)
    await asyncio.to_thread(c.restart)
    await _log("info", "docker", f"Container {c.name} restarted")
    return {"ok": True, "status": "running"}


@api_router.get("/docker/logs/{cid}")
async def docker_logs(cid: str):
    cli = _docker_client()
    c = await asyncio.to_thread(_get_container, cli, cid)
    raw = await asyncio.to_thread(c.logs, tail=100, timestamps=True)
    lines = raw.decode("utf-8", errors="replace").splitlines()
    return {"id": cid, "name": c.name, "lines": lines}


# ----------------------------- Home Assistant -----------------------------
async def _ha_headers() -> dict:
    s = await get_settings()
    tok = s.get("ha_token") or ""
    if not tok:
        raise HTTPException(400, "Home Assistant token not configured")
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _ha_type(entity_id: str, attributes: dict) -> str:
    prefix = entity_id.split(".", 1)[0]
    if prefix in ("light", "switch", "camera", "sensor", "binary_sensor"):
        return prefix
    return prefix


def _ha_normalize(state: dict) -> dict:
    eid = state["entity_id"]
    domain = eid.split(".", 1)[0]
    attrs = state.get("attributes") or {}
    name = attrs.get("friendly_name") or eid
    s = state.get("state", "unknown")
    last = state.get("last_updated") or state.get("last_changed") or datetime.now(timezone.utc).isoformat()
    out = {
        "entity_id": eid,
        "name": name,
        "type": domain,
        "state": s,
        "value": None,
        "unit": attrs.get("unit_of_measurement"),
        "last_updated": last,
    }
    if domain == "sensor":
        out["value"] = s
        out["state"] = "active"
    return out


@api_router.get("/homeassistant/devices")
async def ha_devices():
    s = await get_settings()
    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            r = await cli.get(f"{s['ha_url'].rstrip('/')}/api/states", headers=await _ha_headers())
            r.raise_for_status()
            states = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"HA fetch error: {e}")
        return {"total": 0, "counts": {}, "devices": [], "online": False, "error": str(e)}

    allowed = {"light", "switch", "sensor", "binary_sensor", "camera"}
    devices = [_ha_normalize(st) for st in states if st["entity_id"].split(".", 1)[0] in allowed]
    counts: dict[str, int] = {}
    for d in devices:
        counts[d["type"]] = counts.get(d["type"], 0) + 1
    return {
        "total": len(devices),
        "counts": counts,
        "devices": devices,
        "online": True,
    }


@api_router.post("/homeassistant/toggle/{entity_id}")
async def ha_toggle(entity_id: str):
    s = await get_settings()
    domain = entity_id.split(".", 1)[0]
    if domain not in ("light", "switch"):
        raise HTTPException(400, "Entity not toggleable")
    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            r = await cli.post(
                f"{s['ha_url'].rstrip('/')}/api/services/{domain}/toggle",
                headers=await _ha_headers(),
                json={"entity_id": entity_id},
            )
            r.raise_for_status()
            state_r = await cli.get(
                f"{s['ha_url'].rstrip('/')}/api/states/{entity_id}",
                headers=await _ha_headers(),
            )
            new_state = state_r.json().get("state", "unknown") if state_r.status_code == 200 else "unknown"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"HA error: {e}")
    await _log("info", "ha", f"{entity_id} toggled → {new_state}")
    return {"ok": True, "state": new_state}


# ----------------------------- Ollama -----------------------------
@api_router.get("/ollama/models")
async def ollama_models():
    s = await get_settings()
    base = s["ollama_url"].rstrip("/")
    real_models = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as cli:
            r = await cli.get(f"{base}/api/tags")
            if r.status_code == 200:
                data = r.json()
                for m in data.get("models", []):
                    real_models.append({
                        "name": m.get("name", "unknown"),
                        "parameters": m.get("details", {}).get("parameter_size", "Ollama"),
                        "context": 0,
                        "active": False,
                    })
    except Exception as e:
        logger.info(f"Ollama unreachable: {e}")

    cloud_models = [
        {"name": "claude-sonnet-4.5", "parameters": "Anthropic", "context": 200000, "active": True},
        {"name": "claude-haiku-4.5", "parameters": "Anthropic", "context": 200000, "active": False},
        {"name": "gpt-5.4", "parameters": "OpenAI", "context": 128000, "active": False},
        {"name": "gemini-3.1-pro", "parameters": "Google", "context": 1000000, "active": False},
    ]
    return {"models": cloud_models + real_models}


NEXUS_SYSTEM_PROMPT = (
    "You are NEXUS, the tactical AI core of NEXUS OS — a military sci-fi home infrastructure "
    "operating system running on a Raspberry Pi codenamed RASPBERRY-TENSHI. "
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
        "id": str(uuid.uuid4()), "session_id": session_id,
        "role": "user", "content": req.message, "timestamp": ts,
    })
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": session_id,
        "role": "assistant", "content": reply, "timestamp": ts,
    })
    return ChatResponse(reply=reply, session_id=session_id, timestamp=ts)


# ----------------------------- Audio -----------------------------
@api_router.get("/audio/state")
async def audio_state():
    return AUDIO_STATE


@api_router.post("/audio/play")
async def audio_play(req: AudioPlayRequest):
    AUDIO_STATE["playing"] = True
    AUDIO_STATE["track"] = req.url
    AUDIO_STATE["position"] = 0
    AUDIO_STATE["duration"] = 240
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
    AUDIO_STATE["volume"] = max(0, min(100, req.level))
    return {"ok": True, "volume": AUDIO_STATE["volume"]}


@api_router.post("/audio/tts")
async def audio_tts(req: AudioTTSRequest):
    await _log("info", "audio", f"TTS: {req.text[:60]}")
    return {"ok": True, "spoken": req.text, "voice": req.voice}


# ----------------------------- System telemetry -----------------------------
def _read_psutil_metrics() -> dict:
    """Pull real metrics from psutil if available; otherwise return zeros."""
    try:
        import psutil  # type: ignore
        cpu = psutil.cpu_percent(interval=0.0)
        vm = psutil.virtual_memory()
        ram_used = vm.used / (1024**3)
        ram_total = vm.total / (1024**3)
        temp = 0.0
        try:
            temps = psutil.sensors_temperatures() if hasattr(psutil, "sensors_temperatures") else {}
            for entries in temps.values():
                if entries:
                    temp = float(entries[0].current)
                    break
        except Exception:
            pass
        net = psutil.net_io_counters()
        return {
            "cpu": float(cpu),
            "ram_used": float(ram_used),
            "ram_total": float(ram_total),
            "temp": float(temp),
            "_net_sent": net.bytes_sent,
            "_net_recv": net.bytes_recv,
        }
    except Exception:
        return {"cpu": 0.0, "ram_used": 0.0, "ram_total": 0.0, "temp": 0.0, "_net_sent": 0, "_net_recv": 0}


_LAST_NET = {"sent": 0, "recv": 0, "ts": time.time()}


@api_router.get("/system", response_model=SystemMetrics)
async def system_metrics():
    m = _read_psutil_metrics()
    now = time.time()
    dt = max(0.001, now - _LAST_NET["ts"])
    up_kbs = max(0, (m["_net_sent"] - _LAST_NET["sent"])) / 1024.0 / dt
    dn_kbs = max(0, (m["_net_recv"] - _LAST_NET["recv"])) / 1024.0 / dt
    _LAST_NET["sent"] = m["_net_sent"]
    _LAST_NET["recv"] = m["_net_recv"]
    _LAST_NET["ts"] = now
    return SystemMetrics(
        cpu=round(m["cpu"], 1),
        ram_used=round(m["ram_used"], 2),
        ram_total=round(m["ram_total"], 2) or 8.0,
        temp=round(m["temp"], 1),
        net_up=round(up_kbs, 1),
        net_down=round(dn_kbs, 1),
        uptime=int(now - BOOT_TIME),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "nexus-os", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/")
async def root():
    return {"message": "NEXUS OS API ONLINE", "version": "1.1.0"}


@api_router.get("/nexus/info", response_model=NexusInfo)
async def nexus_info():
    s = await get_settings()
    return NexusInfo(
        hostname=s.get("hostname", "RASPBERRY-TENSHI"),
        ip=s.get("pi_ip", "192.168.12.177"),
        version="1.1.0",
        uptime=int(time.time() - BOOT_TIME),
    )


# ----------------------------- Settings endpoints -----------------------------
@api_router.get("/settings")
async def get_settings_api():
    s = await get_settings()
    return public_settings(s)


@api_router.post("/settings")
async def post_settings_api(update: SettingsUpdate):
    s = await save_settings(update.dict(exclude_unset=True))
    await _log("info", "settings", "Configuration updated")
    return public_settings(s)


@api_router.get("/settings/test")
async def test_settings():
    """Quick connectivity probe against the configured HA, Ollama, Docker and SSH."""
    s = await get_settings()
    result = {"ha": None, "ollama": None, "docker": None, "ssh": None}
    # HA
    try:
        async with httpx.AsyncClient(timeout=5.0) as cli:
            r = await cli.get(
                f"{s['ha_url'].rstrip('/')}/api/",
                headers={"Authorization": f"Bearer {s.get('ha_token','')}"},
            )
            result["ha"] = {"ok": r.status_code == 200, "status": r.status_code}
    except Exception as e:
        result["ha"] = {"ok": False, "error": str(e)}
    # Ollama
    try:
        async with httpx.AsyncClient(timeout=4.0) as cli:
            r = await cli.get(f"{s['ollama_url'].rstrip('/')}/api/tags")
            result["ollama"] = {"ok": r.status_code == 200, "status": r.status_code}
    except Exception as e:
        result["ollama"] = {"ok": False, "error": str(e)}
    # Docker
    try:
        cli = _docker_client()
        info = await asyncio.to_thread(cli.ping)
        result["docker"] = {"ok": bool(info)}
    except HTTPException as e:
        result["docker"] = {"ok": False, "error": e.detail}
    except Exception as e:
        result["docker"] = {"ok": False, "error": str(e)}
    # SSH
    if s.get("ssh_host") and s.get("ssh_user") and s.get("ssh_password"):
        try:
            out, code = await asyncio.to_thread(_ssh_run, s, "echo ok", 6.0)
            result["ssh"] = {"ok": code == 0, "exit_code": code}
        except Exception as e:
            result["ssh"] = {"ok": False, "error": str(e)}
    else:
        result["ssh"] = {"ok": False, "error": "not configured"}
    return result


# ----------------------------- Network map -----------------------------
@api_router.get("/network/scan")
async def network_scan():
    """Build a network topology from real Docker containers + HA devices, with the
    configured Pi as the central node."""
    s = await get_settings()
    devices: list[dict] = [{
        "id": "pi",
        "label": s.get("hostname", "RASPBERRY-TENSHI"),
        "ip": s.get("pi_ip", "192.168.12.177"),
        "mac": "",
        "online": True,
        "latency": 0,
        "central": True,
        "kind": "host",
    }]
    bandwidth = 0.0
    # Docker containers
    try:
        cli = _docker_client()
        containers = await asyncio.to_thread(cli.containers.list, all=False)
        for c in containers:
            devices.append({
                "id": f"docker-{c.short_id}",
                "label": c.name,
                "ip": "",
                "mac": "",
                "online": c.status == "running",
                "latency": 0,
                "central": False,
                "kind": "container",
            })
    except Exception:
        pass
    # HA devices (only physical-ish entities: device_tracker / camera / switch hub)
    try:
        async with httpx.AsyncClient(timeout=6.0) as cli:
            r = await cli.get(
                f"{s['ha_url'].rstrip('/')}/api/states",
                headers={"Authorization": f"Bearer {s.get('ha_token','')}"},
            )
            if r.status_code == 200:
                for st in r.json():
                    eid = st["entity_id"]
                    domain = eid.split(".", 1)[0]
                    if domain in ("device_tracker", "camera"):
                        attrs = st.get("attributes") or {}
                        devices.append({
                            "id": f"ha-{eid}",
                            "label": attrs.get("friendly_name") or eid,
                            "ip": attrs.get("ip") or "",
                            "mac": attrs.get("mac") or "",
                            "online": st["state"] in ("home", "recording", "on", "idle"),
                            "latency": 0,
                            "central": False,
                            "kind": "ha",
                        })
    except Exception:
        pass

    return {
        "central_id": "pi",
        "devices": devices,
        "bandwidth_mbps": bandwidth,
    }


# ----------------------------- Logs -----------------------------
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


# ----------------------------- Terminal -----------------------------
# React Native on Android can stall on POST + chunked responses. Use a fixed
# Content-Length body, Connection: close, and offer GET /terminal/exec so
# mobile clients follow the same fast path as /api/system telemetry.
_IMMEDIATE_JSON_HEADERS = {
    "Connection": "close",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Accel-Buffering": "no",
}

_SSH_POOL_LOCK = threading.Lock()
_SSH_POOL: dict[tuple, Any] = {}


def _immediate_json(payload: dict) -> Response:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={**_IMMEDIATE_JSON_HEADERS, "Content-Length": str(len(body))},
    )


def _ssh_pool_key(s: dict) -> tuple:
    return (
        s["ssh_host"],
        int(s.get("ssh_port") or 22),
        s["ssh_user"],
        s.get("ssh_password") or "",
    )


def _ssh_connect(s: dict):
    import paramiko

    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(
        hostname=s["ssh_host"],
        port=int(s.get("ssh_port") or 22),
        username=s["ssh_user"],
        password=s.get("ssh_password") or None,
        timeout=6.0,
        banner_timeout=6.0,
        auth_timeout=6.0,
        look_for_keys=False,
        allow_agent=False,
        gss_auth=False,
        gss_kex=False,
    )
    return cli


def _ssh_get_client(s: dict):
    key = _ssh_pool_key(s)
    cli = _SSH_POOL.get(key)
    if cli is not None:
        transport = cli.get_transport()
        if transport is not None and transport.is_active():
            return cli, key
        try:
            cli.close()
        except Exception:
            pass
        _SSH_POOL.pop(key, None)
    cli = _ssh_connect(s)
    _SSH_POOL[key] = cli
    return cli, key


def _ssh_invalidate(key: tuple) -> None:
    cli = _SSH_POOL.pop(key, None)
    if cli is not None:
        try:
            cli.close()
        except Exception:
            pass


async def _terminal_exec_payload(req: TerminalCommandRequest) -> dict:
    """Run a command. If SSH is configured (ssh_host + ssh_user + ssh_password),
    execute it on the real Pi via paramiko. Otherwise fall back to the simulated
    shell so the UI is always usable."""
    t0 = time.monotonic()
    cmd = (req.command or "").strip()
    s = await get_settings()
    use_ssh = bool(s.get("ssh_host") and s.get("ssh_user") and s.get("ssh_password"))
    ts = datetime.now(timezone.utc).isoformat()
    if use_ssh and cmd not in ("clear", "help", "?"):
        try:
            out, exit_code = await asyncio.to_thread(_ssh_run, s, cmd)
            return {
                "command": cmd,
                "output": out,
                "exit_code": exit_code,
                "source": "ssh",
                "host": f"{s['ssh_user']}@{s['ssh_host']}:{s.get('ssh_port', 22)}",
                "timestamp": ts,
                "timing_ms": round((time.monotonic() - t0) * 1000, 1),
            }
        except Exception as e:
            return {
                "command": cmd,
                "output": f"[ssh error] {e}",
                "exit_code": -1,
                "source": "ssh",
                "host": f"{s.get('ssh_user','?')}@{s.get('ssh_host','?')}",
                "timestamp": ts,
                "timing_ms": round((time.monotonic() - t0) * 1000, 1),
            }
    out = _simulate_shell(cmd)
    return {
        "command": cmd,
        "output": out,
        "exit_code": 0,
        "source": "sim",
        "host": "nexus@raspberry-tenshi",
        "timestamp": ts,
        "timing_ms": round((time.monotonic() - t0) * 1000, 1),
    }


@api_router.get("/terminal/exec")
async def terminal_exec_get(command: str = ""):
    return _immediate_json(await _terminal_exec_payload(TerminalCommandRequest(command=command)))


@api_router.post("/terminal/exec")
async def terminal_exec_post(req: TerminalCommandRequest):
    return _immediate_json(await _terminal_exec_payload(req))


def _ssh_run(s: dict, cmd: str, timeout: float = 12.0) -> tuple[str, int]:
    with _SSH_POOL_LOCK:
        key = _ssh_pool_key(s)
        try:
            cli, key = _ssh_get_client(s)
            stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout, get_pty=False)
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            exit_code = stdout.channel.recv_exit_status()
            text = (out + (("\n" + err) if err else "")).rstrip()
            return text or "(no output)", exit_code
        except Exception:
            _ssh_invalidate(key)
            raise


@api_router.get("/terminal/ssh-test")
@api_router.post("/terminal/ssh-test")
async def terminal_ssh_test():
    s = await get_settings()
    if not (s.get("ssh_host") and s.get("ssh_user") and s.get("ssh_password")):
        return _immediate_json({"ok": False, "configured": False, "error": "ssh credentials not set"})
    try:
        out, code = await asyncio.to_thread(_ssh_run, s, "echo NEXUS_SSH_OK && hostname && uname -srm", timeout=8.0)
        return _immediate_json({
            "ok": code == 0 and "NEXUS_SSH_OK" in out,
            "configured": True,
            "exit_code": code,
            "output": out,
            "host": f"{s['ssh_user']}@{s['ssh_host']}:{s.get('ssh_port', 22)}",
        })
    except Exception as e:
        return _immediate_json({"ok": False, "configured": True, "error": str(e)})


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
            try:
                cli = _docker_client()
                cs = cli.containers.list(all=True)
                return "\n".join([f"{c.short_id}  {c.name:<16}  {c.status:<10}  {(c.image.tags[0] if c.image.tags else '?')}" for c in cs]) or "(no containers)"
            except Exception as e:
                return f"docker error: {e}"
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
                "OS: NEXUS OS 1.1.0\n"
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


@app.on_event("startup")
async def on_startup():
    # Seed token from request if collection is empty
    existing = await db.nexus_settings.find_one({"_id": "singleton"})
    if not existing:
        await db.nexus_settings.update_one(
            {"_id": "singleton"},
            {"$set": DEFAULT_SETTINGS},
            upsert=True,
        )
    await _log("info", "system", "NEXUS OS core online")
    await _log("info", "system", f"Settings loaded; HA target = {DEFAULT_SETTINGS['ha_url']}")
    await _log("info", "system", f"Ollama target = {DEFAULT_SETTINGS['ollama_url']}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
