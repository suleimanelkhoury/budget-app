"""Tests for JWT revocation (jti blocklist) and the logout endpoint."""

from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.security import create_access_token
from app.services.token_blocklist import is_token_revoked, revoke_token


class TestTokenJti:
    """Tokens carry a jti (JWT ID) claim for revocation."""

    def test_token_contains_jti(self):
        token = create_access_token(subject=1)
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        assert payload["jti"]
        assert len(payload["jti"]) == 32  # uuid4().hex

    def test_tokens_have_distinct_jtis(self):
        first = create_access_token(subject=1)
        second = create_access_token(subject=1)
        decode = lambda t: jwt.decode(  # noqa: E731
            t, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        assert decode(first)["jti"] != decode(second)["jti"]


class TestTokenBlocklistService:
    """Unit tests for the blocklist service functions."""

    def test_revoked_token_is_reported_revoked(self, db_session):
        jti = "a" * 32
        expires = datetime.now(UTC) + timedelta(hours=1)
        revoke_token(db_session, jti=jti, expires_at=expires)
        assert is_token_revoked(db_session, jti)

    def test_unrevoked_token_not_reported(self, db_session):
        assert not is_token_revoked(db_session, "b" * 32)

    def test_already_expired_token_not_revoked(self, db_session):
        """Revoking an expired token is a no-op — it's invalid anyway."""
        jti = "c" * 32
        past = datetime.now(UTC) - timedelta(hours=1)
        revoke_token(db_session, jti=jti, expires_at=past)
        assert not is_token_revoked(db_session, jti)

    def test_purge_removes_expired_entries(self, db_session):
        """Purging on revoke cleans up entries whose tokens have expired."""
        expired_jti = "d" * 32
        still_valid_jti = "e" * 32
        revoke_token(
            db_session,
            jti=expired_jti,
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        revoke_token(
            db_session,
            jti=still_valid_jti,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
        assert not is_token_revoked(db_session, expired_jti)
        assert is_token_revoked(db_session, still_valid_jti)


class TestLogoutEndpoint:
    """POST /api/auth/logout revokes the presented token server-side."""

    def test_logout_revokes_token(self, client, auth_headers):
        # Token works before logout
        assert client.get("/api/auth/me", headers=auth_headers).status_code == 200

        response = client.post("/api/auth/logout", headers=auth_headers)
        assert response.status_code == 204

        # The same token is now rejected everywhere
        assert client.get("/api/auth/me", headers=auth_headers).status_code == 401

    def test_new_token_still_works_after_logout(self, client):
        """Only the presented token is revoked, not the user's account."""
        creds = {"email": "logout@test.com", "password": "securepass123"}
        client.post("/api/auth/register", json=creds)

        first = client.post("/api/auth/login", json=creds).json()["access_token"]
        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {first}"})

        second = client.post("/api/auth/login", json=creds).json()["access_token"]
        response = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {second}"}
        )
        assert response.status_code == 200

    def test_logout_without_token_rejected(self, client):
        response = client.post("/api/auth/logout")
        assert response.status_code == 401

    def test_logout_twice_rejected(self, client, auth_headers):
        """An already-revoked token can't be used to log out again."""
        assert client.post("/api/auth/logout", headers=auth_headers).status_code == 204
        response = client.post("/api/auth/logout", headers=auth_headers)
        assert response.status_code == 401


class TestLegacyTokensRejected:
    """Tokens without a jti (pre-revocation format) are rejected."""

    def test_token_without_jti_rejected(self, client, db_session):
        payload = {
            "sub": "1",
            "exp": datetime.now(UTC) + timedelta(hours=1),
            "iat": datetime.now(UTC),
            "type": "access",
            # no jti
        }
        legacy_token = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        response = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {legacy_token}"}
        )
        assert response.status_code == 401
