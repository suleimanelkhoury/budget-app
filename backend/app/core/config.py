"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings — values come from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # ── App ────────────────────────────────────
    APP_NAME: str = "Budget App API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api"

    # ── Database ───────────────────────────────
    # Default to SQLite for local dev; override with PostgreSQL URL in prod.
    DATABASE_URL: str = "sqlite:///./budget.db"

    # ── Auth / JWT ─────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── CORS ───────────────────────────────────
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


# The well-known dev default — must never be used in production.
INSECURE_DEFAULT_SECRET_KEY = "change-me-in-production"

# Minimum entropy requirement for the signing key (HS256).
MIN_SECRET_KEY_LENGTH = 32


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


settings = get_settings()


def validate_security_settings() -> None:
    """Fail fast if security-critical settings are still at their defaults.

    Called on application startup. Skipped when DEBUG is enabled so local
    development and the test suite keep working with the default key.

    Raises:
        RuntimeError: If SECRET_KEY is the known default or too short.
            Without a strong secret, JWTs can be forged by anyone who knows
            the default, i.e. full account takeover.
    """
    if settings.DEBUG:
        return

    if settings.SECRET_KEY == INSECURE_DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is still set to the default value. Anyone can forge "
            "authentication tokens with it. Generate a strong key with:\n"
            "  python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    if len(settings.SECRET_KEY) < MIN_SECRET_KEY_LENGTH:
        raise RuntimeError(
            f"SECRET_KEY is too short (minimum {MIN_SECRET_KEY_LENGTH} "
            "characters). Generate a strong key with:\n"
            "  python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
