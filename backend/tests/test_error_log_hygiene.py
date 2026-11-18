"""Tests that server error responses/logs don't leak sensitive details."""

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db


class FakeSession:
    """Stand-in DB session whose queries fail with a marker payload."""

    def scalar(self, *args, **kwargs):
        raise SQLAlchemyError(
            "SELECT * FROM users WHERE email = 'LEAKED-EMAIL@example.com'"
        )

    def close(self) -> None:
        pass


@pytest.fixture()
def broken_db(client):
    """Override get_db with a session that raises on first query."""

    def override():
        yield FakeSession()

    client.app.dependency_overrides[get_db] = override
    yield
    client.app.dependency_overrides.pop(get_db, None)


class TestDatabaseErrorHandling:
    """SQLAlchemy errors return a generic 500 without leaking payloads."""

    def test_database_error_returns_generic_500(self, client, broken_db):
        response = client.post(
            "/api/auth/register",
            json={"email": "victim@test.com", "password": "securepass123"},
        )
        assert response.status_code == 500
        message = response.json()["error"]["message"].lower()
        # Generic message, not the raw exception string
        assert "database error" in message
        assert "leaked-email" not in message

    def test_database_error_payload_not_in_logs(
        self, client, broken_db, caplog
    ):
        with caplog.at_level("ERROR"):
            client.post(
                "/api/auth/register",
                json={"email": "victim2@test.com", "password": "securepass123"},
            )
        # The exception message (with SQL/param values) must not be logged
        assert "LEAKED-EMAIL" not in caplog.text
        # But the error class is, for debuggability
        assert "SQLAlchemyError" in caplog.text


class TestUnhandledErrorHandling:
    """Generic exceptions are logged by type, not by message."""

    @pytest.fixture()
    def forgiving_client(self):
        """TestClient that returns the 500 instead of re-raising."""
        from fastapi.testclient import TestClient

        from app.main import app

        return TestClient(app, raise_server_exceptions=False)

    def test_unhandled_error_returns_generic_500(self, forgiving_client):
        from app.core.deps import get_current_user

        def explode():
            raise RuntimeError("secret user input BANANA-42")

        forgiving_client.app.dependency_overrides[get_current_user] = explode
        try:
            response = forgiving_client.get("/api/auth/me")
        finally:
            forgiving_client.app.dependency_overrides.pop(get_current_user, None)

        assert response.status_code == 500
        assert "BANANA-42" not in response.text
        message = response.json()["error"]["message"].lower()
        assert "unexpected error" in message

    def test_unhandled_error_message_not_in_logs(self, forgiving_client, caplog):
        from app.core.deps import get_current_user

        def explode():
            raise RuntimeError("secret user input BANANA-42")

        forgiving_client.app.dependency_overrides[get_current_user] = explode
        try:
            with caplog.at_level("ERROR"):
                forgiving_client.get("/api/auth/me")
        finally:
            forgiving_client.app.dependency_overrides.pop(get_current_user, None)

        assert "BANANA-42" not in caplog.text
        assert "RuntimeError" in caplog.text
