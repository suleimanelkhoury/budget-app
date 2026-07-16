"""Template models — reusable budget templates with pre-filled categories.

A BudgetTemplate is a named collection of TemplateCategory → TemplateItem
rows. When a user creates a budget from a template, the template's
categories and items are copied into the new budget (with zeroed amounts),
saving the user from re-entering recurring category structures.

Templates are user-scoped: each user can build their own library of
templates (e.g. "Standard Month", "Vacation", "Minimal").
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class BudgetTemplate(Base):
    """A reusable budget template owned by a user."""

    __tablename__ = "budget_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "Standard Month"

    # ── Relationships ──────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="templates")
    categories: Mapped[list["TemplateCategory"]] = relationship(
        "TemplateCategory",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="TemplateCategory.sort_order.asc(), TemplateCategory.id.asc()",
    )

    def __repr__(self) -> str:
        return f"<BudgetTemplate id={self.id} name={self.name!r}>"


class TemplateCategory(Base):
    """A category within a budget template."""

    __tablename__ = "template_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("budget_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Relationships ──────────────────────────
    template: Mapped["BudgetTemplate"] = relationship(
        "BudgetTemplate", back_populates="categories"
    )
    items: Mapped[list["TemplateItem"]] = relationship(
        "TemplateItem",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="TemplateItem.id",
    )

    def __repr__(self) -> str:
        return f"<TemplateCategory id={self.id} name={self.name!r}>"


class TemplateItem(Base):
    """An expense item within a template category (amounts left at zero)."""

    __tablename__ = "template_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("template_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    # ── Relationships ──────────────────────────
    category: Mapped["TemplateCategory"] = relationship(
        "TemplateCategory", back_populates="items"
    )

    def __repr__(self) -> str:
        return f"<TemplateItem id={self.id} label={self.label!r}>"
