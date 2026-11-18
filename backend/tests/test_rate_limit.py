"""Tests for the auth endpoint rate limiter (app/core/rate_limit.py)."""

import pytest
from redis.exceptions import RedisError

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


class _ExplodingRedis:
    """Stub Redis client whose every operation raises (simulates an outage)."""

    def pipeline(self, transaction=True):
        raise RedisError("redis is down")


@pytest.fixture()
def redis_limiter(client, limiter):
    """Same as `limiter`, but backed by a fresh fakeredis instance."""
    import fakeredis.aioredis

    limiter._redis = fakeredis.aioredis.FakeRedis()
    yield limiter
    limiter._redis = None


class TestRedisBackend:
    """The Redis backend enforces the same limits, globally."""

    def test_allows_up_to_limit_then_429(self, client, redis_limiter):
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            r = client.post("/api/auth/login", json=payload)
            assert r.status_code == 401

        r = client.post("/api/auth/login", json=payload)
        assert r.status_code == 429
        assert "retry-after" in {k.lower() for k in r.headers}

    def test_429_uses_app_error_format(self, client, redis_limiter):
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            client.post("/api/auth/login", json=payload)

        r = client.post("/api/auth/login", json=payload)
        body = r.json()
        assert body["error"]["status_code"] == 429
        assert body["error"]["path"] == "/api/auth/login"
        assert body["error"]["method"] == "POST"

    def test_register_limit_enforced(self, client, redis_limiter):
        for _ in range(3):
            r = client.post(
                "/api/auth/register",
                json={"email": f"ruser{_}@test.com", "password": "password123"},
            )
            assert r.status_code == 201

        r = client.post(
            "/api/auth/register",
            json={"email": "ruser4@test.com", "password": "password123"},
        )
        assert r.status_code == 429

    def test_retry_after_within_window(self, client, redis_limiter):
        """Retry-After reflects the remaining fixed window, not an error."""
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            client.post("/api/auth/login", json=payload)

        r = client.post("/api/auth/login", json=payload)
        retry_after = int(r.headers["Retry-After"])
        assert 1 <= retry_after <= 60  # RATE_LIMIT_WINDOW_SECONDS

    def test_other_ips_are_not_affected(self, client, redis_limiter):
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        for _ in range(5):
            client.post("/api/auth/login", json=payload)

        # A different client IP (via X-Forwarded-For) still gets through
        r = client.post(
            "/api/auth/login",
            json=payload,
            headers={"X-Forwarded-For": "203.0.113.77"},
        )
        assert r.status_code == 401


class TestRedisFailOpen:
    """A Redis outage must not lock users out of authentication."""

    def test_redis_error_fails_open(self, client, limiter):
        limiter._redis = _ExplodingRedis()
        payload = {"email": "nobody@test.com", "password": "wrong-password"}
        try:
            # Way past the limit — every request still reaches the app
            # (401 invalid credentials) instead of being rate limited.
            for _ in range(10):
                r = client.post("/api/auth/login", json=payload)
                assert r.status_code == 401
        finally:
            limiter._redis = None
