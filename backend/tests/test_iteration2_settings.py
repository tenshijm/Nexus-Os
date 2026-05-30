"""Iteration 2 backend tests — SETTINGS tab + real-integration graceful degradation."""
import os
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

# Seeded value from /app/backend/.env — last 4 chars used for mask verification
SEEDED_TOKEN_TAIL = "tZ8E"
SEEDED_TOKEN_HEAD = "eyJhbG"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ----------------------- Settings endpoints -----------------------
class TestSettings:
    def test_get_settings_shape(self, s):
        r = s.get(f"{API}/settings", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("ha_url", "ollama_url", "pi_ip", "hostname", "ha_token_set", "ha_token_masked"):
            assert k in d, f"missing {k}"
        # ha_token must NOT be returned
        assert "ha_token" not in d
        assert d["ha_token_set"] is True
        # masked token must contain head+tail of seeded token
        assert SEEDED_TOKEN_HEAD in d["ha_token_masked"]
        assert SEEDED_TOKEN_TAIL in d["ha_token_masked"]

    def test_post_updates_ollama_url_preserves_token(self, s):
        new_url = "http://other:11434"
        # get original for restore
        orig = s.get(f"{API}/settings", timeout=10).json()
        r = s.post(f"{API}/settings", json={"ollama_url": new_url}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["ollama_url"] == new_url
        # token still set
        assert body["ha_token_set"] is True
        assert SEEDED_TOKEN_TAIL in body["ha_token_masked"]
        # verify via GET
        g = s.get(f"{API}/settings", timeout=10).json()
        assert g["ollama_url"] == new_url
        # restore
        s.post(f"{API}/settings", json={"ollama_url": orig["ollama_url"]}, timeout=10)

    def test_post_replaces_token(self, s):
        new_token = "TEST_NEW_TOKEN_VALUE_1234567890ABCDEF"
        # capture original
        orig = s.get(f"{API}/settings", timeout=10).json()
        orig_masked = orig["ha_token_masked"]
        # replace
        r = s.post(f"{API}/settings", json={"ha_token": new_token}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["ha_token_set"] is True
        assert d["ha_token_masked"] != orig_masked
        assert new_token[-4:] in d["ha_token_masked"]
        # verify via GET
        g = s.get(f"{API}/settings", timeout=10).json()
        assert new_token[-4:] in g["ha_token_masked"]
        # restore original real token from .env
        real = os.environ.get("HA_TOKEN") or (
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJpc3MiOiIxN2NkNTlhMGNlYmU0MTJkYjdjMGVhYzRmODIwMTE0MyIsImlhdCI6MTc4MDExODQzNSwiZXhwIjoyMDk1NDc4NDM1fQ."
            "M0InOx1g5InRVmrqmGC5OSBALL5KrSa3TmgLAUgtZ8E"
        )
        s.post(f"{API}/settings", json={"ha_token": real}, timeout=10)
        post_restore = s.get(f"{API}/settings", timeout=10).json()
        assert SEEDED_TOKEN_TAIL in post_restore["ha_token_masked"]

    def test_settings_test_probe_returns_200(self, s):
        r = s.get(f"{API}/settings/test", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("ha", "ollama", "docker"):
            assert k in d
            assert "ok" in d[k]
        # cloud env: all expected to be false but endpoint must return 200


# ----------------------- Real integrations: graceful degradation -----------------------
class TestRealIntegrations:
    def test_docker_returns_array_no_5xx(self, s):
        r = s.get(f"{API}/docker", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ha_devices_unreachable_graceful(self, s):
        r = s.get(f"{API}/homeassistant/devices", timeout=15)
        # HA unreachable from cloud preview — should return 200 with online:false
        assert r.status_code == 200
        d = r.json()
        # Either reachable with devices, or graceful failure
        assert "online" in d or "devices" in d
        if d.get("online") is False:
            assert "error" in d

    def test_ha_devices_empty_token_returns_400(self, s):
        # save empty token, expect 400 from /homeassistant/devices
        orig = s.get(f"{API}/settings", timeout=10).json()
        real_token = os.environ.get("HA_TOKEN") or (
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJpc3MiOiIxN2NkNTlhMGNlYmU0MTJkYjdjMGVhYzRmODIwMTE0MyIsImlhdCI6MTc4MDExODQzNSwiZXhwIjoyMDk1NDc4NDM1fQ."
            "M0InOx1g5InRVmrqmGC5OSBALL5KrSa3TmgLAUgtZ8E"
        )
        try:
            r0 = s.post(f"{API}/settings", json={"ha_token": ""}, timeout=10)
            assert r0.status_code == 200
            assert r0.json()["ha_token_set"] is False
            r = s.get(f"{API}/homeassistant/devices", timeout=15)
            assert r.status_code == 400
        finally:
            # restore
            s.post(f"{API}/settings", json={"ha_token": real_token}, timeout=10)
            restored = s.get(f"{API}/settings", timeout=10).json()
            assert restored["ha_token_set"] is True

    def test_network_scan_has_pi_central(self, s):
        r = s.get(f"{API}/network/scan", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("central_id") == "pi"
        assert isinstance(d.get("devices"), list)
        ids = [x["id"] for x in d["devices"]]
        assert "pi" in ids
        # confirm central pi node
        pi = next(x for x in d["devices"] if x["id"] == "pi")
        assert pi.get("central") is True

    def test_system_psutil_metrics(self, s):
        r = s.get(f"{API}/system", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["cpu"] >= 0
        assert d["ram_used"] > 0, "psutil ram_used should be > 0"
        assert d["ram_total"] > 0, "psutil ram_total should be > 0"
        assert "timestamp" in d and d["timestamp"]
        assert isinstance(d["uptime"], int)

    def test_ollama_models_cloud_listed(self, s):
        r = s.get(f"{API}/ollama/models", timeout=15)
        assert r.status_code == 200
        d = r.json()
        names = [m["name"] for m in d["models"]]
        # cloud models still present even if ollama unreachable
        assert "claude-sonnet-4.5" in names
        assert any("gpt" in n for n in names)
        assert any("gemini" in n for n in names)

    def test_ollama_chat_claude_works(self, s):
        r = s.post(f"{API}/ollama/chat", json={"message": "short status"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d.get("reply")
        assert isinstance(d["reply"], str)
        assert len(d["reply"]) > 0
        assert d.get("session_id")


# ----------------------- Persistence -----------------------
class TestPersistence:
    def test_settings_persist_post_then_get(self, s):
        orig = s.get(f"{API}/settings", timeout=10).json()
        try:
            new_host = "TEST_NEXUS_HOST"
            r = s.post(f"{API}/settings", json={"hostname": new_host}, timeout=10)
            assert r.status_code == 200
            assert r.json()["hostname"] == new_host
            g = s.get(f"{API}/settings", timeout=10).json()
            assert g["hostname"] == new_host
        finally:
            s.post(f"{API}/settings", json={"hostname": orig["hostname"]}, timeout=10)
