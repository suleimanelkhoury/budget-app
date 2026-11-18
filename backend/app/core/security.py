"""Security utilities — password hashing and JWT token handling."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt is the recommended hashing scheme
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password hashing ──────────────────────────
def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# Throwaway hash for timing equalization (see verify_dummy_password).
# Generated once at import; the plaintext is discarded immediately.
# bcrypt verify always runs the full cost, so checking against this
# costs the same as a real password check.
_dummy_password_hash = hash_password(secrets.token_urlsafe(16))


def verify_dummy_password(plain_password: str) -> None:
    """Verify a password against a throwaway hash and discard the result.

    Used on authentication failure paths (unknown email on login,
    duplicate email on registration) so those responses take the same
    time as requests against real accounts. Without this, response
    timing would reveal whether an email is registered — bcrypt only
    runs for existing users, making "fast 401" a reliable account
    enumeration oracle.
    """
    verify_password(plain_password, _dummy_password_hash)


# ── JWT token handling ────────────────────────
def create_access_token(
    subject: str | int, expires_delta: timedelta | None = None
) -> str:
    """Create a JWT access token.

    Args:
        subject: The subject of the token (typically the user ID as str).
        expires_delta: Optional custom expiration time. Defaults to
            settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        The encoded JWT string.
    """
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(UTC),
        # jti (JWT ID) — unique token identifier, used by the revocation
        # blocklist so tokens can be invalidated server-side (logout).
        "jti": uuid.uuid4().hex,
        "type": "access",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and verify a JWT access token.

    Args:
        token: The JWT string to decode.

    Returns:
        The token payload as a dict if valid, otherwise None.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None
