"""Pydantic schemas for ExpenseItem — create, update, response."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ExpenseItemBase(BaseModel):
    """Shared fields for expense items."""

    label: str = Field(..., min_length=1, max_length=100)
    projected_cost: Decimal = Field(default=Decimal("0"), ge=0)
    actual_cost: Decimal = Field(default=Decimal("0"), ge=0)


class ExpenseItemCreate(ExpenseItemBase):
    """Request body for creating an expense item."""

    pass


class ExpenseItemUpdate(BaseModel):
    """Request body for updating an expense item — all fields optional."""

    label: str | None = Field(None, min_length=1, max_length=100)
    projected_cost: Decimal | None = Field(None, ge=0)
    actual_cost: Decimal | None = Field(None, ge=0)


class ExpenseItemResponse(ExpenseItemBase):
    """Expense item returned to the client, including the calculated difference."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    difference: Decimal
