"""Pydantic schema for Excel import response."""

from pydantic import BaseModel


class ExcelImportResponse(BaseModel):
    """Response returned after a successful Excel import."""

    budget_id: int
    budget_title: str
    categories_imported: int
    income_imported: int
    items_imported: int
    message: str = "Budget imported successfully"
