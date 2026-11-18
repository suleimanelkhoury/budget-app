"""Tests for account-enumeration hardening on the auth endpoints.

The register 409 inherently reveals that an email exists (the full fix
would require an email-verification flow). What these tests pin down is
that the *timing* side channels are closed: duplicate registration and
unknown-email login must still perform bcrypt work, so "fast failure"
can't be used as an enumeration oracle.
"""

from app.api import auth as auth_api


class TestLoginTimingEqualization:
    """Unknown-email logins must run a dummy bcrypt verify."""

    def test_unknown_email_triggers_dummy_verify(self, client, monkeypatch):
        calls = []
        monkeypatch.setattr(
            auth_api,
            "verify_dummy_password",
            lambda password: calls.append(password),
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "somepassword"},
        )
        assert response.status_code == 401
        assert len(calls) == 1
        assert calls[0] == "somepassword"  # the submitted password is burned

    def test_wrong_password_does_not_trigger_dummy_verify(
        self, client, monkeypatch
    ):
        """Existing account + wrong password uses the real verify path."""
        calls = []
        monkeypatch.setattr(
            auth_api,
            "verify_dummy_password",
            lambda password: calls.append(password),
        )
        client.post(
            "/api/auth/register",
            json={"email": "timing@test.com", "password": "securepass123"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "timing@test.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert calls == []

    def test_unknown_email_login_behavior_unchanged(self, client):
        """The dummy verify must not change the visible response."""
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "whatever123"},
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["error"]["message"].lower()


class TestRegisterTimingEqualization:
    """Duplicate-email registrations must still do bcrypt work."""

    def test_duplicate_email_triggers_hash(self, client, monkeypatch):
        payload = {"email": "timingdup@test.com", "password": "securepass123"}
        # Create the account first (unpatched), so the spy only sees the
        # conflict-path request.
        client.post("/api/auth/register", json=payload)

        calls = []
        monkeypatch.setattr(
            auth_api, "hash_password", lambda password: calls.append(password)
        )
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 409
        assert len(calls) == 1  # one hash burned on the conflict path
        assert calls[0] == "securepass123"

    def test_duplicate_email_behavior_unchanged(self, client):
        """The dummy hash must not change the visible response."""
        payload = {"email": "timingdup2@test.com", "password": "securepass123"}
        client.post("/api/auth/register", json=payload)

        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 409
        message = response.json()["error"]["message"].lower()
        assert "already exists" in message
