"""Rate limiting for sensitive endpoints (login, register).

Fixed-window limiter keyed by client IP, applied as pure ASGI middleware.

Storage backends:
- Redis (set RATE_LIMIT_REDIS_URL): counters live in Redis, written with an
  atomic MULTI/EXEC pipeline (SET NX EX + INCR + TTL), so the limit is
  global across all uvicorn workers. Recommended in production (the prod
  compose runs `--workers 4` and ships a redis service).
- In-memory fallback (default, RATE_LIMIT_REDIS_URL empty): per-worker
  deques, so the effective limit is up to `workers`-times the configured
  one. Fine for single-process dev and the test suite.

On any Redis error the limiter fails open (the request is allowed) so a
Redis outage can't lock users out of authentication; the error is logged.

The client IP is taken from the first entry of X-Forwarded-For. In the
production topology (browser → Caddy → nginx → backend) Caddy sets XFF to
the real client IP and downstream proxies only append, so the first entry
is trustworthy there. If the backend is ever exposed directly, clients
could spoof XFF to rotate keys.
"""

import time
from collections import defaultdict, deque

from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# (method, path, max_requests, window_seconds)
RATE_LIMIT_RULES: list[tuple[str, str, int, int]] = [
    (
        "POST",
        "/api/auth/login",
        settings.RATE_LIMIT_LOGIN_MAX,
        settings.RATE_LIMIT_WINDOW_SECONDS,
    ),
    (
        "POST",
        "/api/auth/register",
        settings.RATE_LIMIT_REGISTER_MAX,
        settings.RATE_LIMIT_WINDOW_SECONDS,
    ),
]


def _client_ip(scope: dict) -> str:
    """Return the client IP for rate-limit keying.

    Prefers the first X-Forwarded-For entry (original client), falling
    back to the direct connection peer.
    """
    headers = Headers(scope=scope)
    forwarded = headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


class RateLimitMiddleware:
    """Fixed-window rate limiter for a set of (method, path) rules.

    Uses Redis when a client is available (injected or built from
    settings.RATE_LIMIT_REDIS_URL), otherwise per-worker in-memory state.
    """

    def __init__(
        self,
        app,
        rules: list[tuple[str, str, int, int]] | None = None,
        redis_client: Redis | None = None,
    ):
        self.app = app
        self.rules = rules if rules is not None else RATE_LIMIT_RULES
        self.enabled = settings.RATE_LIMIT_ENABLED
        # (client_ip, path) -> timestamps of requests inside the window
        # (only used by the in-memory fallback)
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        if redis_client is not None:
            self._redis: Redis | None = redis_client
        elif settings.RATE_LIMIT_REDIS_URL:
            self._redis = Redis.from_url(settings.RATE_LIMIT_REDIS_URL)
        else:
            self._redis = None

    def _match_rule(
        self, method: str, path: str
    ) -> tuple[int, int] | None:
        """Return (max_requests, window_seconds) for the request, if any."""
        for rule_method, rule_path, max_requests, window in self.rules:
            if method == rule_method and path == rule_path:
                return max_requests, window
        return None

    def _too_many_requests(
        self, scope: dict, retry_after: int
    ) -> JSONResponse:
        """Build a 429 response in the app's error envelope format."""
        headers = Headers(scope=scope)
        lang = (
            "de"
            if headers.get("accept-language", "").lower().startswith("de")
            else "en"
        )
        message = (
            "Zu viele Anfragen — bitte versuchen Sie es später erneut."
            if lang == "de"
            else "Too many requests — please try again later."
        )
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={
                "error": {
                    "status_code": 429,
                    "message": message,
                    "detail": None,
                    "path": scope["path"],
                    "method": scope["method"],
                }
            },
        )

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or not self.enabled:
            await self.app(scope, receive, send)
            return

        rule = self._match_rule(scope["method"], scope["path"])
        if rule is None:
            await self.app(scope, receive, send)
            return
        max_requests, window = rule

        if self._redis is not None:
            allowed, retry_after = await self._check_redis(
                scope, max_requests, window
            )
        else:
            allowed, retry_after = self._check_memory(
                scope, max_requests, window
            )

        if not allowed:
            logger.warning(
                "rate_limited",
                path=scope["path"],
                method=scope["method"],
                client_ip=_client_ip(scope),
                max_requests=max_requests,
                window_seconds=window,
                backend="redis" if self._redis is not None else "memory",
            )
            await self._too_many_requests(scope, retry_after)(scope, receive, send)
            return

        await self.app(scope, receive, send)

    async def _check_redis(
        self, scope: dict, max_requests: int, window: int
    ) -> tuple[bool, int]:
        """Count the request in Redis and decide whether it may pass.

        The three commands run as one atomic transaction: SET NX EX
        (re)creates the key with the window TTL only when absent — so the
        window is fixed, not extended by later hits — then INCR counts
        this request and TTL reads the remaining window for Retry-After.

        Returns (allowed, retry_after_seconds).
        """
        key = f"ratelimit:{_client_ip(scope)}:{scope['path']}"
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.set(key, 0, ex=window, nx=True)
                pipe.incr(key)
                pipe.ttl(key)
                _, current, ttl = await pipe.execute()
        except RedisError as exc:
            # Fail open: a Redis outage must not lock users out of auth.
            logger.warning(
                "rate_limit_redis_error",
                path=scope["path"],
                method=scope["method"],
                error_type=type(exc).__name__,
            )
            return True, 0

        if current > max_requests:
            # ttl can be -1/-2 in edge cases (key expiry race); the
            # full window is the safe fallback in those.
            return False, max(1, ttl) if ttl > 0 else window
        return True, 0

    def _check_memory(
        self, scope: dict, max_requests: int, window: int
    ) -> tuple[bool, int]:
        """In-memory fixed-window check (per uvicorn worker).

        Returns (allowed, retry_after_seconds).
        """
        key = (_client_ip(scope), scope["path"])
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > window:
            hits.popleft()

        if len(hits) >= max_requests:
            retry_after = max(1, int(window - (now - hits[0])) + 1)
            return False, retry_after

        hits.append(now)

        # Opportunistic cleanup so the key map can't grow unbounded
        # (pruned-empty entries and stale IPs).
        if len(self._hits) > 10_000:
            for stale in [k for k, v in self._hits.items() if not v]:
                del self._hits[stale]

        return True, 0


def get_rate_limit_middleware(app) -> "RateLimitMiddleware | None":
    """Find the RateLimitMiddleware instance in the app's middleware stack.

    The stack is built lazily on the first request, so this returns None
    if no request has been served yet. Used by tests to toggle/reset the
    limiter.
    """
    node = getattr(app, "middleware_stack", None)
    while node is not None:
        if isinstance(node, RateLimitMiddleware):
            return node
        node = getattr(node, "app", None)
    return None
