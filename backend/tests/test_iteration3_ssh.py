"""Iteration 3 backend tests — SSH integration + graceful degradation.

Covers:
- /api/settings now exposes ssh_host/ssh_port/ssh_user/ssh_password_set
  and OMITS the raw ssh_password.
- POST /api/settings can update non-secret ssh fields and toggle ssh_password_set.
- /api/terminal/exec degrades to sim mode when SSH is not configured.
- /api/terminal/ssh-test returns configured:false when no creds,
  and {ok:false, configured:true} when creds are set but the host unreachable.
- /api/settings/test still works and reports SSH (key may be missing — flagged).
- /api/ollama/chat still works after iteration 3.
Cleanup: clears ssh_password and restores ssh fields to defaults.
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # Final cleanup — make absolutely sure ssh_password is empty
    s.post(f"{BASE_URL}/api/settings", json={"ssh_password": ""})


# --- /api/settings shape ---
def test_settings_has_ssh_fields_no_raw_password(api):
    r = api.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    d = r.json()
    for k in ("ssh_host", "ssh_port", "ssh_user", "ssh_password_set"):
        assert k in d, f"missing key {k}"
    assert "ssh_password" not in d, "raw ssh_password must NOT be returned"
    assert isinstance(d["ssh_password_set"], bool)
    assert isinstance(d["ssh_port"], int)


def test_settings_update_non_secret_ssh_fields(api):
    payload = {"ssh_user": "pi", "ssh_host": "10.0.0.1", "ssh_port": 2222}
    r = api.post(f"{BASE_URL}/api/settings", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["ssh_user"] == "pi"
    assert d["ssh_host"] == "10.0.0.1"
    assert d["ssh_port"] == 2222
    # GET reflects them
    g = api.get(f"{BASE_URL}/api/settings").json()
    assert g["ssh_user"] == "pi"
    assert g["ssh_host"] == "10.0.0.1"
    assert g["ssh_port"] == 2222


def test_settings_ssh_password_set_toggle(api):
    # Initially clear
    api.post(f"{BASE_URL}/api/settings", json={"ssh_password": ""})
    g0 = api.get(f"{BASE_URL}/api/settings").json()
    assert g0["ssh_password_set"] is False
    # Set password
    r = api.post(f"{BASE_URL}/api/settings", json={"ssh_password": "secret123"})
    assert r.status_code == 200
    body = r.json()
    assert body["ssh_password_set"] is True
    assert "ssh_password" not in body
    g1 = api.get(f"{BASE_URL}/api/settings").json()
    assert g1["ssh_password_set"] is True
    assert "ssh_password" not in g1


# --- /api/terminal/ssh-test ---
def test_ssh_test_configured_true_but_fails(api):
    # password is set from previous test, host is 10.0.0.1:2222 — unreachable
    r = api.post(f"{BASE_URL}/api/terminal/ssh-test")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert d["configured"] is True
    assert "error" in d and isinstance(d["error"], str) and len(d["error"]) > 0


def test_ssh_test_not_configured(api):
    # Clear password
    api.post(f"{BASE_URL}/api/settings", json={"ssh_password": ""})
    r = api.post(f"{BASE_URL}/api/terminal/ssh-test")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert d["configured"] is False


# --- /api/terminal/exec ---
def test_terminal_exec_falls_back_to_sim(api):
    # Ensure password cleared so we go through sim path
    api.post(f"{BASE_URL}/api/settings", json={"ssh_password": ""})
    r = api.post(f"{BASE_URL}/api/terminal/exec", json={"command": "uptime"})
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "sim"
    assert d["exit_code"] == 0
    assert "load average" in d["output"]
    assert d["host"] == "nexus@raspberry-tenshi"


def test_terminal_exec_ssh_source_when_configured(api):
    # Set bogus password — should still try ssh path and report source=ssh
    api.post(f"{BASE_URL}/api/settings", json={"ssh_password": "bogus"})
    r = api.post(f"{BASE_URL}/api/terminal/exec", json={"command": "uptime"})
    assert r.status_code == 200
    d = r.json()
    assert d["source"] == "ssh", f"expected ssh path, got {d}"
    # Will fail to connect — but should NOT crash, exit_code != 0 expected
    assert d["exit_code"] != 0 or "[ssh error]" in d["output"]
    # Cleanup
    api.post(f"{BASE_URL}/api/settings", json={"ssh_password": ""})


# --- /api/settings/test ---
def test_settings_test_includes_ssh(api):
    r = api.get(f"{BASE_URL}/api/settings/test")
    assert r.status_code == 200
    d = r.json()
    for k in ("ha", "ollama", "docker"):
        assert k in d
    # The iteration spec says 'ssh' must also be present.
    assert "ssh" in d, "iteration-3 spec: /api/settings/test must include 'ssh' key"
    assert d["ssh"]["ok"] is False


# --- regression: Claude Sonnet 4.5 chat ---
def test_ollama_chat_still_works(api):
    r = api.post(
        f"{BASE_URL}/api/ollama/chat",
        json={"message": "Reply with the single word: NOMINAL"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 0
    assert "session_id" in d


# --- cleanup test (runs last alphabetically) ---
def test_zzz_cleanup_ssh_password(api):
    api.post(f"{BASE_URL}/api/settings", json={
        "ssh_password": "",
        "ssh_user": "nexus",
        "ssh_host": "192.168.12.177",
        "ssh_port": 22,
    })
    g = api.get(f"{BASE_URL}/api/settings").json()
    assert g["ssh_password_set"] is False
    assert g["ssh_user"] == "nexus"
    assert g["ssh_host"] == "192.168.12.177"
    assert g["ssh_port"] == 22
