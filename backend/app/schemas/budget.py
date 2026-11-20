"""Pydantic schemas for Budget — create, update, response, and detail (nested)."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from app.schemas.category import CategoryResponse
    from app.schemas.income import IncomeResponse


class BudgetBase(BaseModel):
    """Shared fields for budget creation and updates."""

    title: str = Field(..., min_length=1, max_length=100)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=1900, le=2100)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title must not be blank")
        return v.strip()


class BudgetCreate(BudgetBase):
    """Request body for creating a budget."""

    pass


class BudgetUpdate(BaseModel):
    """Request body for updating a budget — all fields optional."""

    title: str | None = Field(None, min_length=1, max_length=100)
    month: int | None = Field(None, ge=1, le=12)
    year: int | None = Field(None, ge=1900, le=2100)


class BudgetClone(BaseModel):
    """Request body for cloning a budget into a new month.

    Powers the recurring-expense-templates feature: the source budget's
    categories, items, and income are copied. Actual amounts are zeroed
    out unless `copy_actuals` is true.
    """

    title: str = Field(..., min_length=1, max_length=100)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=1900, le=2100)
    copy_actuals: bool = Field(
        default=False,
        description="If true, copy actual amounts too; otherwise zero them out.",
    )

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title must not be blank")
        return v.strip()


class BudgetResponse(BudgetBase):
    """Budget data returned in list views (no nested data)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at", mode="after")
    @classmethod
    def naive_datetimes_are_utc(cls, v: datetime) -> datetime:
        """Attach UTC to tz-naive timestamps.

        SQLite's CURRENT_TIMESTAMP returns naive datetimes that are
        actually UTC — without an explicit offset, browsers parse them
        as local time and every displayed time is off by the UTC
        offset. PostgreSQL returns tz-aware values, which pass through
        untouched.
        """
        return v.replace(tzinfo=UTC) if v.tzinfo is None else v


class BudgetDetail(BudgetResponse):
    """Budget with nested categories, items, and income — for the detail view."""

    incomes: list["IncomeResponse"] = []
    categories: list["CategoryResponse"] = []
