"""Token blocklist service — server-side JWT revocation.

Revoked tokens are tracked by their jti (JWT ID) claim in the
revoked_tokens table. Entries are only kept until the token's natural
expiry — an expired JWT is rejected anyway, so stale rows are purged
whenever new tokens are revoked.
"""

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.revoked_token import RevokedToken


def revoke_token(db: Session, jti: str, expires_at: datetime) -> None:
    """Add a token to the blocklist until its natural expiry.

    Purges already-expired entries in the same commit to keep the table
    small.
    """
    now = datetime.now(UTC)
    # Only bother revoking tokens that are still valid
    if expires_at <= now:
        return
    db.add(RevokedToken(jti=jti, expires_at=expires_at))
    _purge_expired(db, now)
    db.commit()


def is_token_revoked(db: Session, jti: str) -> bool:
    """Check whether a token's jti is on the blocklist."""
    return (
        db.scalar(select(RevokedToken.jti).where(RevokedToken.jti == jti))
        is not None
    )


def _purge_expired(db: Session, now: datetime) -> None:
    """Delete blocklist entries for tokens that have already expired."""
    db.execute(delete(RevokedToken).where(RevokedToken.expires_at <= now))
