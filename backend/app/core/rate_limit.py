"""In-memory rate limiting for sensitive endpoints (login, register).

Fixed-window limiter keyed by client IP, applied as pure ASGI middleware
(no extra dependencies).

Notes:
- State is per uvicorn worker process. The prod compose runs
  `--workers 4`, so the effective limit is up to 4x the configured one.
  A strict global limit would need shared storage (e.g. Redis), which is
  overkill for a single-instance budget app.
- The client IP is taken from the first entry of X-Forwarded-For. In the
  production topology (browser → Caddy → nginx → backend) Caddy sets
  XFF to the real client IP and downstream proxies only append, so the
  first entry is trustworthy there. If the backend is ever exposed
  directly, clients could spoof XFF to rotate keys.
"""

import time
from collections import defaultdict, deque

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
    """Fixed-window rate limiter for a set of (method, path) rules."""

    def __init__(self, app, rules: list[tuple[str, str, int, int]] | None = None):
        self.app = app
        self.rules = rules if rules is not None else RATE_LIMIT_RULES
        self.enabled = settings.RATE_LIMIT_ENABLED
        # (client_ip, path) -> timestamps of requests inside the window
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

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

        key = (_client_ip(scope), scope["path"])
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > window:
            hits.popleft()

        if len(hits) >= max_requests:
            retry_after = max(1, int(window - (now - hits[0])) + 1)
            logger.warning(
                "rate_limited",
                path=scope["path"],
                method=scope["method"],
                client_ip=key[0],
                max_requests=max_requests,
                window_seconds=window,
            )
            await self._too_many_requests(scope, retry_after)(scope, receive, send)
            return

        hits.append(now)

        # Opportunistic cleanup so the key map can't grow unbounded
        # (pruned-empty entries and stale IPs).
        if len(self._hits) > 10_000:
            for stale in [k for k, v in self._hits.items() if not v]:
                del self._hits[stale]

        await self.app(scope, receive, send)


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
