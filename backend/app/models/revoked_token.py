"""RevokedToken model — JWT blocklist for server-side token revocation."""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RevokedToken(Base):
    """A revoked JWT, identified by its jti (JWT ID) claim.

    Rows are kept only until the token's natural expiry — after that the
    JWT would be rejected anyway, so the entry is purged to keep the
    table small.
    """

    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RevokedToken jti={self.jti!r} expires_at={self.expires_at!r}>"
