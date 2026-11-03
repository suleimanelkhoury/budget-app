"""Pydantic schemas for Income — create, update, response."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class IncomeBase(BaseModel):
    """Shared fields for income entries.

    Amounts may be negative (e.g. refunds, adjustments, overpayments), so no
    lower bound is enforced.
    """

    label: str = Field(..., min_length=1, max_length=100)
    projected_amount: Decimal = Field(default=Decimal("0"))
    actual_amount: Decimal = Field(default=Decimal("0"))


class IncomeCreate(IncomeBase):
    """Request body for creating an income entry."""

    pass


class IncomeUpdate(BaseModel):
    """Request body for updating an income entry — all fields optional."""

    label: str | None = Field(None, min_length=1, max_length=100)
    projected_amount: Decimal | None = Field(None)
    actual_amount: Decimal | None = Field(None)


class IncomeResponse(IncomeBase):
    """Income entry returned to the client, including the calculated difference."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    budget_id: int
    difference: Decimal
