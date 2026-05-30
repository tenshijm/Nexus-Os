"""NEXUS OS backend API tests via public preview URL."""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://home-nexus-deploy.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ----------------------------- Nexus info / system -----------------------------
def test_nexus_info(s):
    r = s.get(f"{API}/nexus/info", timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["hostname"] == "RASPBERRY-TENSHI"
    assert j["ip"] == "192.168.12.177"
    assert isinstance(j["uptime"], int)


def test_system_metrics(s):
    r = s.get(f"{API}/system", timeout=20)
    assert r.status_code == 200
    j = r.json()
    for k in ("cpu", "ram_used", "ram_total", "temp", "net_up", "net_down", "uptime", "timestamp"):
        assert k in j, f"Missing key {k}"
    assert j["ram_total"] == 8.0


# ----------------------------- Docker -----------------------------
def test_docker_list(s):
    r = s.get(f"{API}/docker", timeout=20)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 6
    sample = arr[0]
    for k in ("id", "name", "status", "cpu", "ram_mb", "uptime"):
        assert k in sample


def test_docker_stop_and_start(s):
    cid = "c1"  # homeassistant
    r1 = s.post(f"{API}/docker/stop/{cid}", timeout=20)
    assert r1.status_code == 200 and r1.json()["status"] == "stopped"

    # Verify via GET
    arr = s.get(f"{API}/docker", timeout=20).json()
    c1 = next(c for c in arr if c["id"] == cid)
    assert c1["status"] == "stopped"

    r2 = s.post(f"{API}/docker/start/{cid}", timeout=20)
    assert r2.status_code == 200 and r2.json()["status"] == "running"

    arr = s.get(f"{API}/docker", timeout=20).json()
    c1 = next(c for c in arr if c["id"] == cid)
    assert c1["status"] == "running"


def test_docker_restart(s):
    r = s.post(f"{API}/docker/restart/c2", timeout=20)
    assert r.status_code == 200 and r.json()["status"] == "running"


def test_docker_logs(s):
    r = s.get(f"{API}/docker/logs/c1", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "lines" in j and len(j["lines"]) == 100


def test_docker_not_found(s):
    r = s.post(f"{API}/docker/stop/nonexistent", timeout=20)
    assert r.status_code == 404


# ----------------------------- Home Assistant -----------------------------
def test_ha_devices(s):
    r = s.get(f"{API}/homeassistant/devices", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "total" in j and "counts" in j and "devices" in j
    assert j["total"] >= 40  # ~42 devices
    assert isinstance(j["devices"], list)


def test_ha_toggle_light(s):
    devs = s.get(f"{API}/homeassistant/devices", timeout=20).json()["devices"]
    light = next(d for d in devs if d["type"] == "light")
    eid = light["entity_id"]
    prev = light["state"]
    r = s.post(f"{API}/homeassistant/toggle/{eid}", timeout=20)
    assert r.status_code == 200
    new = r.json()["state"]
    assert new != prev
    assert new in ("on", "off")


def test_ha_toggle_sensor_rejected(s):
    devs = s.get(f"{API}/homeassistant/devices", timeout=20).json()["devices"]
    sensor = next(d for d in devs if d["type"] == "sensor")
    r = s.post(f"{API}/homeassistant/toggle/{sensor['entity_id']}", timeout=20)
    assert r.status_code == 400


# ----------------------------- Ollama / AI -----------------------------
def test_ollama_models(s):
    r = s.get(f"{API}/ollama/models", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "models" in j and len(j["models"]) >= 1
    names = [m["name"] for m in j["models"]]
    assert any("claude-sonnet" in n for n in names)


def test_ollama_chat(s):
    r = s.post(f"{API}/ollama/chat", json={"message": "hello"}, timeout=90)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "reply" in j and isinstance(j["reply"], str) and len(j["reply"]) > 0
    assert "session_id" in j


# ----------------------------- Audio -----------------------------
def test_audio_play_and_stop(s):
    r = s.post(f"{API}/audio/play", json={"url": "http://test/stream.mp3"}, timeout=20)
    assert r.status_code == 200 and r.json()["state"]["playing"] is True

    r2 = s.post(f"{API}/audio/stop", timeout=20)
    assert r2.status_code == 200 and r2.json()["state"]["playing"] is False


def test_audio_volume(s):
    r = s.post(f"{API}/audio/volume", json={"level": 65}, timeout=20)
    assert r.status_code == 200 and r.json()["volume"] == 65


def test_audio_tts(s):
    r = s.post(f"{API}/audio/tts", json={"text": "Hello operator"}, timeout=20)
    assert r.status_code == 200 and r.json()["spoken"] == "Hello operator"


# ----------------------------- Network -----------------------------
def test_network_scan(s):
    r = s.get(f"{API}/network/scan", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["central_id"] == "n1"
    central = next(d for d in j["devices"] if d["id"] == "n1")
    assert central["label"] == "RASPBERRY-TENSHI"


# ----------------------------- Logs -----------------------------
def test_logs_list_and_clear(s):
    r = s.get(f"{API}/logs?limit=10", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    rc = s.post(f"{API}/logs/clear", timeout=20)
    assert rc.status_code == 200 and rc.json()["ok"] is True


# ----------------------------- Terminal -----------------------------
def test_terminal_uptime(s):
    r = s.post(f"{API}/terminal/exec", json={"command": "uptime"}, timeout=20)
    assert r.status_code == 200
    out = r.json()["output"]
    assert "load average" in out


def test_terminal_help(s):
    r = s.post(f"{API}/terminal/exec", json={"command": "help"}, timeout=20)
    assert r.status_code == 200
    assert "uptime" in r.json()["output"]


def test_terminal_unknown(s):
    r = s.post(f"{API}/terminal/exec", json={"command": "foobar123"}, timeout=20)
    assert r.status_code == 200
    assert "not found" in r.json()["output"]
