"""Tests for security-critical settings validation (startup guard)."""

import pytest

from app.core import config


class TestValidateSecuritySettings:
    """validate_security_settings must refuse weak/default JWT secrets."""

    def test_default_secret_raises_when_not_debug(self, monkeypatch):
        monkeypatch.setattr(config.settings, "DEBUG", False)
        monkeypatch.setattr(
            config.settings, "SECRET_KEY", config.INSECURE_DEFAULT_SECRET_KEY
        )
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            config.validate_security_settings()

    def test_short_secret_raises_when_not_debug(self, monkeypatch):
        monkeypatch.setattr(config.settings, "DEBUG", False)
        monkeypatch.setattr(config.settings, "SECRET_KEY", "too-short")
        with pytest.raises(RuntimeError, match="too short"):
            config.validate_security_settings()

    def test_empty_secret_raises_when_not_debug(self, monkeypatch):
        monkeypatch.setattr(config.settings, "DEBUG", False)
        monkeypatch.setattr(config.settings, "SECRET_KEY", "")
        with pytest.raises(RuntimeError):
            config.validate_security_settings()

    def test_strong_secret_passes_when_not_debug(self, monkeypatch):
        monkeypatch.setattr(config.settings, "DEBUG", False)
        monkeypatch.setattr(config.settings, "SECRET_KEY", "x" * 32)
        config.validate_security_settings()  # must not raise

    def test_default_secret_allowed_in_debug(self, monkeypatch):
        monkeypatch.setattr(config.settings, "DEBUG", True)
        monkeypatch.setattr(
            config.settings, "SECRET_KEY", config.INSECURE_DEFAULT_SECRET_KEY
        )
        config.validate_security_settings()  # must not raise
