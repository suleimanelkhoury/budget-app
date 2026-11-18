"""Tests that API docs endpoints are hidden when DEBUG is off (fix #6).

The FastAPI app is a module-level singleton built at import time, so the
DEBUG=false behavior is verified in a subprocess with its own environment.
"""

import os
import subprocess
import sys

# Runs in a fresh interpreter: docs must be gone, API must still work.
_CHECK_SCRIPT = """
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as client:
    for path in ("/docs", "/redoc", "/api/openapi.json"):
        r = client.get(path)
        assert r.status_code == 404, f"{path} returned {r.status_code}"

    r = client.get("/api/health")
    assert r.status_code == 200, f"/api/health returned {r.status_code}"

print("OK")
"""


def test_docs_hidden_and_api_working_when_debug_off():
    env = {
        **os.environ,
        "DEBUG": "false",
        # Strong key to pass the startup SECRET_KEY guard
        "SECRET_KEY": "0" * 32,
        "RATE_LIMIT_ENABLED": "false",
    }
    result = subprocess.run(
        [sys.executable, "-c", _CHECK_SCRIPT],
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"subprocess failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
    )
    assert "OK" in result.stdout


def test_docs_present_in_debug_mode(client):
    """In debug mode (the test suite default) the docs are still served."""
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    assert client.get("/api/openapi.json").status_code == 200
