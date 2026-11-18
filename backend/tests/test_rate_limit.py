"""Tests for the auth endpoint rate limiter (app/core/rate_limit.py)."""

import pytest

from app.core.rate_limit import get_rate_limit_middleware
from app.main import app


@pytest.fixture()
def limiter(client):
    """Enable the rate limiter for one test, with fresh state.

    The middleware stack is built lazily on the first request, so hit the
    health endpoint once first to force it.
    """
    client.get("/api/health")
    middleware = get_rate_limit_middleware(app)
    assert middleware is not None, "RateLimitMiddleware not found in the stack"
    middleware.enabled = True
    middleware._hits.clear()
    yield middleware
    middleware.enabled = False
    middleware._hits.clear()


class TestLoginRateLimit:
    """POST /api/auth/login allows 5 requests per minute per IP."""

    def test_allows_up_to_limit_then_429(self, client, limiter):
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            r = client.post("/api/auth/login", json=payload)
            assert r.status_code == 401  # invalid credentials, not limited

        r = client.post("/api/auth/login", json=payload)
        assert r.status_code == 429
        assert "retry-after" in {k.lower() for k in r.headers}

    def test_429_uses_app_error_format(self, client, limiter):
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            client.post("/api/auth/login", json=payload)

        r = client.post("/api/auth/login", json=payload)
        body = r.json()
        assert body["error"]["status_code"] == 429
        assert body["error"]["path"] == "/api/auth/login"
        assert body["error"]["method"] == "POST"
        assert "message" in body["error"]

    def test_other_ips_are_not_affected(self, client, limiter):
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            client.post("/api/auth/login", json=payload)

        # A different client IP (via X-Forwarded-For) still gets through
        r = client.post(
            "/api/auth/login",
            json=payload,
            headers={"X-Forwarded-For": "203.0.113.77"},
        )
        assert r.status_code == 401  # processed normally, not limited


class TestRegisterRateLimit:
    """POST /api/auth/register allows 3 requests per minute per IP."""

    def test_allows_up_to_limit_then_429(self, client, limiter):
        for _ in range(3):
            r = client.post(
                "/api/auth/register",
                json={"email": f"user{_}@test.com", "password": "password123"},
            )
            assert r.status_code == 201

        r = client.post(
            "/api/auth/register",
            json={"email": "user4@test.com", "password": "password123"},
        )
        assert r.status_code == 429

    def test_failed_registrations_count_toward_limit(self, client, limiter):
        for _ in range(3):
            client.post(
                "/api/auth/register",
                json={"email": "taken@test.com", "password": "password123"},
            )
        # First attempt created the account; attempts 2-3 were 409s —
        # all count. The 4th request must be limited regardless.
        r = client.post(
            "/api/auth/register",
            json={"email": "another@test.com", "password": "password123"},
        )
        assert r.status_code == 429


class TestOtherEndpointsUnaffected:
    """The limiter only applies to the configured auth endpoints."""

    def test_health_endpoint_not_limited(self, client, limiter):
        for _ in range(20):
            r = client.get("/api/health")
            assert r.status_code == 200

    def test_get_requests_to_login_path_not_limited(self, client, limiter):
        # Only POST is limited; GET /api/auth/login is a 405, not a 429
        for _ in range(10):
            r = client.get("/api/auth/login")
            assert r.status_code == 405
