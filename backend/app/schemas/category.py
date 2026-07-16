"""Pydantic schemas for Category — create, update, response (with nested items)."""

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from app.schemas.expense_item import ExpenseItemResponse


class CategoryBase(BaseModel):
    """Shared fields for category entries."""

    name: str = Field(..., min_length=1, max_length=100)
    sort_order: int = Field(default=0, ge=0)


class CategoryCreate(CategoryBase):
    """Request body for creating a category."""

    pass


class CategoryUpdate(BaseModel):
    """Request body for updating a category — all fields optional."""

    name: str | None = Field(None, min_length=1, max_length=100)
    sort_order: int | None = Field(None, ge=0)


class CategoryResponse(CategoryBase):
    """Category returned to the client, including nested expense items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    budget_id: int
    items: list["ExpenseItemResponse"] = []
