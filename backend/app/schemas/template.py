"""Pydantic schemas for budget templates — create, update, response."""

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from app.schemas.template import TemplateCategoryResponse


class TemplateItemBase(BaseModel):
    """Shared fields for template items."""

    label: str = Field(..., min_length=1, max_length=100)


class TemplateItemCreate(TemplateItemBase):
    """Request body for creating a template item."""

    pass


class TemplateItemResponse(TemplateItemBase):
    """Template item returned to the client."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int


class TemplateCategoryBase(BaseModel):
    """Shared fields for template categories."""

    name: str = Field(..., min_length=1, max_length=100)
    sort_order: int = Field(default=0, ge=0)


class TemplateCategoryCreate(TemplateCategoryBase):
    """Request body for creating a template category."""

    items: list[TemplateItemCreate] = Field(default_factory=list)


class TemplateCategoryResponse(TemplateCategoryBase):
    """Template category returned to the client, including nested items."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    items: list[TemplateItemResponse] = []


class BudgetTemplateBase(BaseModel):
    """Shared fields for budget templates."""

    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class BudgetTemplateCreate(BaseModel):
    """Request body for creating a budget template.

    Accepts a name and a list of categories (each with their items). This
    lets the frontend create a full template in a single request.
    """

    name: str = Field(..., min_length=1, max_length=100)
    categories: list[TemplateCategoryCreate] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class BudgetTemplateUpdate(BaseModel):
    """Request body for updating a budget template — all fields optional."""

    name: str | None = Field(None, min_length=1, max_length=100)


class BudgetTemplateResponse(BaseModel):
    """Budget template returned to the client, including nested categories."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    categories: list[TemplateCategoryResponse] = []


class CreateBudgetFromTemplate(BaseModel):
    """Request body for creating a budget from a template.

    The template's categories and items are copied into the new budget
    with zeroed amounts. The user supplies the title, month, and year.
    """

    title: str = Field(..., min_length=1, max_length=100)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=1900, le=2100)
