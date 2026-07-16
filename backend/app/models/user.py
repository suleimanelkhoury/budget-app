"""User model — application user with email + password authentication."""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    """A registered user of the budget app."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────
    budgets: Mapped[list["Budget"]] = relationship(  # noqa: F821
        "Budget",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Budget.year.desc(), Budget.month.desc()",
    )
    templates: Mapped[list["BudgetTemplate"]] = relationship(  # noqa: F821
        "BudgetTemplate",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="BudgetTemplate.id",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
