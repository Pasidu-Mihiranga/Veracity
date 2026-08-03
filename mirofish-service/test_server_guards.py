"""Guard tests for the MiroFish service.

This process holds a model API key and does unbounded model work on request, so
the two things that must never regress are: it does not serve strangers, and it
does not let a caller-supplied identifier escape the data directory.

Run with:  cd mirofish-service && .venv/bin/python -m pytest test_server_guards.py
"""

import os
import sys
import importlib
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

TOKEN = "test-token-value"


@pytest.fixture()
def app_module(tmp_path, monkeypatch):
    """Import the service with a token configured and an isolated data dir."""
    monkeypatch.setenv("MIROFISH_SERVICE_TOKEN", TOKEN)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("GEMINI_API_KEY", "unused-in-these-tests")

    import server

    importlib.reload(server)
    return server


@pytest.fixture()
def client(app_module):
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


# ── Authentication ──────────────────────────────────────────────────────────


def test_health_needs_no_token(client):
    """Health has to stay reachable or nothing can check whether this is up."""
    assert client.get("/health").status_code == 200
    assert client.get("/api/health").status_code == 200


def test_api_route_rejects_missing_token(client):
    response = client.get("/api/graph/project/list")
    assert response.status_code == 401


def test_api_route_rejects_wrong_token(client):
    response = client.get(
        "/api/graph/project/list", headers={"X-MiroFish-Token": "not-the-token"}
    )
    assert response.status_code == 401


def test_api_route_accepts_correct_token(client):
    response = client.get(
        "/api/graph/project/list", headers={"X-MiroFish-Token": TOKEN}
    )
    assert response.status_code != 401


def test_service_refuses_to_serve_without_a_configured_token(tmp_path, monkeypatch):
    """An unset token must fail closed.

    Falling open here is how the service ends up exposed in the one environment
    nobody checked, so the absence of configuration is treated as a hard stop
    rather than as "no auth required".
    """
    monkeypatch.delenv("MIROFISH_SERVICE_TOKEN", raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    import server

    importlib.reload(server)
    server.app.config["TESTING"] = True
    client = server.app.test_client()

    assert client.get("/api/graph/project/list").status_code == 503
    # Health still answers, so a supervisor can tell the difference between
    # "misconfigured" and "dead".
    assert client.get("/health").status_code == 200


# ── Path traversal ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "identifier",
    [
        "../../etc",
        "..",
        "sim/../../..",
        "/absolute/path",
        "sim\x00null",
        "a" * 200,
        "",
        "has space",
        "semi;colon",
    ],
)
def test_directory_helpers_reject_hostile_identifiers(app_module, identifier):
    with pytest.raises(ValueError):
        app_module.sim_dir(identifier)
    with pytest.raises(ValueError):
        app_module.proj_dir(identifier)


def test_directory_helpers_accept_generated_ids(app_module, tmp_path):
    sim_id = app_module.new_sim_id()
    proj_id = app_module.new_project_id()

    sim_path = app_module.sim_dir(sim_id)
    proj_path = app_module.proj_dir(proj_id)

    # Both must land inside the configured data directory, not beside it.
    assert tmp_path.resolve() in sim_path.parents
    assert tmp_path.resolve() in proj_path.parents
    assert sim_path.is_dir()
    assert proj_path.is_dir()


def test_generated_ids_match_the_safe_pattern(app_module):
    for _ in range(20):
        assert app_module._SAFE_ID.match(app_module.new_sim_id())
        assert app_module._SAFE_ID.match(app_module.new_project_id())
        assert app_module._SAFE_ID.match(app_module.new_task_id())


# ── Binding ─────────────────────────────────────────────────────────────────


def test_default_host_is_loopback(app_module):
    """The default must be private.

    A networked default means one careless deployment exposes the model quota,
    and the person deploying it has no reason to suspect anything is wrong.
    """
    assert os.getenv("MIROFISH_HOST", "127.0.0.1") == "127.0.0.1"
