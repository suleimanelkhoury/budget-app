"""ExpenseItem model — a single expense line within a category."""

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.category import Category


class ExpenseItem(Base):
    """An expense item, e.g. 'Miete' or 'Strom', with projected & actual costs."""

    __tablename__ = "expense_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "Miete", "Strom"
    projected_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )
    actual_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )

    # ── Relationships ──────────────────────────
    category: Mapped["Category"] = relationship("Category", back_populates="items")

    @property
    def difference(self) -> Decimal:
        """Difference = projected - actual (positive = under budget)."""
        return self.projected_cost - self.actual_cost

    def __repr__(self) -> str:
        return f"<ExpenseItem id={self.id} label={self.label!r}>"
