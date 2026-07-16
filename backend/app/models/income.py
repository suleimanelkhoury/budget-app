"""Income model — an income entry within a budget (projected vs. actual)."""

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.budget import Budget


class Income(Base):
    """An income line item, e.g. 'Einkommen' or 'Extra'."""

    __tablename__ = "incomes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    budget_id: Mapped[int] = mapped_column(
        ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "Einkommen", "Extra"
    projected_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )
    actual_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )

    # ── Relationships ──────────────────────────
    budget: Mapped["Budget"] = relationship("Budget", back_populates="incomes")

    @property
    def difference(self) -> Decimal:
        """Difference = projected - actual (positive = earned more than expected)."""
        return self.projected_amount - self.actual_amount

    def __repr__(self) -> str:
        return f"<Income id={self.id} label={self.label!r}>"
