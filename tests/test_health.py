"""Container readiness: /health must not depend on the database."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.main import health_check


def test_health_returns_200_without_db():
    app = FastAPI()
    app.add_api_route("/health", health_check, methods=["GET"])
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "version" in body


def test_health_source_has_no_db_dependency():
    import inspect

    source = inspect.getsource(health_check)
    assert "get_db" not in source
    assert "async_session" not in source.lower()
    assert "init_db" not in source
