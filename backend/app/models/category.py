"""Category model — a budget category (Wohnen, Transport, Essen, etc.)."""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.budget import Budget
    from app.models.expense_item import ExpenseItem


class Category(Base):
    """A spending category within a budget, e.g. 'Wohnen', 'Transport'."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    budget_id: Mapped[int] = mapped_column(
        ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "Wohnen"
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Relationships ──────────────────────────
    budget: Mapped["Budget"] = relationship("Budget", back_populates="categories")
    items: Mapped[list["ExpenseItem"]] = relationship(
        "ExpenseItem",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="ExpenseItem.id",
    )

    def __repr__(self) -> str:
        return f"<Category id={self.id} name={self.name!r}>"
