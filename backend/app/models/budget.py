"""Budget model — a monthly budget belonging to a user."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.income import Income
    from app.models.user import User


class Budget(Base):
    """A monthly budget, e.g. 'Juli 2026'."""

    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "Juli 2026"
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12
    year: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 2026
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="budgets")
    incomes: Mapped[list["Income"]] = relationship(
        "Income",
        back_populates="budget",
        cascade="all, delete-orphan",
        order_by="Income.id",
    )
    categories: Mapped[list["Category"]] = relationship(
        "Category",
        back_populates="budget",
        cascade="all, delete-orphan",
        order_by="Category.sort_order.asc(), Category.id.asc()",
    )

    def __repr__(self) -> str:
        return f"<Budget id={self.id} title={self.title!r}>"
