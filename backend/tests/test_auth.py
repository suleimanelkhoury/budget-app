"""Tests for authentication endpoints — register, login, and /me."""

import pytest


# ── Registration ──────────────────────────────
class TestRegister:
    """Tests for POST /api/auth/register."""

    def test_register_success(self, client):
        """A new user can register and receives a token."""
        response = client.post(
            "/api/auth/register",
            json={"email": "newuser@test.com", "password": "securepass123"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["token_type"] == "bearer"
        assert "access_token" in data
        assert data["user"]["email"] == "newuser@test.com"
        assert "password_hash" not in data["user"]
        assert "password" not in data["user"]
        assert "id" in data["user"]

    def test_register_duplicate_email(self, client):
        """Registering with an existing email returns 409."""
        payload = {"email": "dup@test.com", "password": "securepass123"}
        client.post("/api/auth/register", json=payload)

        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 409
        body = response.json()
        # AppException responses use {"error": {"message": ...}}
        message = body.get("error", {}).get("message", "")
        assert "already exists" in message.lower()

    def test_register_invalid_email(self, client):
        """An invalid email format returns a 422 validation error."""
        response = client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "securepass123"},
        )
        assert response.status_code == 422

    def test_register_short_password(self, client):
        """A password shorter than 8 characters returns a 422 validation error."""
        response = client.post(
            "/api/auth/register",
            json={"email": "short@test.com", "password": "short"},
        )
        assert response.status_code == 422

    def test_register_missing_fields(self, client):
        """Missing required fields return a 422 validation error."""
        response = client.post("/api/auth/register", json={"email": "a@b.com"})
        assert response.status_code == 422


# ── Login ─────────────────────────────────────
class TestLogin:
    """Tests for POST /api/auth/login."""

    @pytest.fixture()
    def registered_user(self, client):
        """Register a user that login tests can authenticate."""
        creds = {"email": "login@test.com", "password": "securepass123"}
        client.post("/api/auth/register", json=creds)
        return creds

    def test_login_success(self, client, registered_user):
        """A registered user can log in and receives a token."""
        response = client.post("/api/auth/login", json=registered_user)
        assert response.status_code == 200
        data = response.json()
        assert data["token_type"] == "bearer"
        assert "access_token" in data
        assert data["user"]["email"] == registered_user["email"]

    def test_login_wrong_password(self, client, registered_user):
        """Login with the wrong password returns 401."""
        response = client.post(
            "/api/auth/login",
            json={"email": registered_user["email"], "password": "wrongpassword"},
        )
        assert response.status_code == 401
        body = response.json()
        # HTTPException handler returns {"error": {"message": ...}}
        message = body.get("error", {}).get("message", "")
        assert "incorrect" in message.lower()

    def test_login_nonexistent_user(self, client):
        """Login with an unregistered email returns 401."""
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "somepassword"},
        )
        assert response.status_code == 401

    def test_login_invalid_email_format(self, client):
        """Login with an invalid email format returns 422."""
        response = client.post(
            "/api/auth/login",
            json={"email": "not-an-email", "password": "somepassword"},
        )
        assert response.status_code == 422


# ── Get Current User (/me) ────────────────────
class TestGetCurrentUser:
    """Tests for GET /api/auth/me."""

    @pytest.fixture()
    def auth_token(self, client):
        """Register a user and return their access token."""
        creds = {"email": "me@test.com", "password": "securepass123"}
        response = client.post("/api/auth/register", json=creds)
        return response.json()["access_token"]

    def test_get_me_with_valid_token(self, client, auth_token):
        """An authenticated request returns the user's profile."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me@test.com"
        assert "password_hash" not in data

    def test_get_me_without_token(self, client):
        """A request without a token returns 401."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_me_with_invalid_token(self, client):
        """A request with a malformed token returns 401."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer not.a.valid.token"},
        )
        assert response.status_code == 401

    def test_get_me_with_tampered_token(self, client, auth_token):
        """A token with a modified payload returns 401."""
        # Tamper with the token by changing the last few characters
        tampered = auth_token[:-4] + "XXXX"
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {tampered}"},
        )
        assert response.status_code == 401
