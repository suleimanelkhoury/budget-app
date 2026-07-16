"""API package — FastAPI routers."""

from app.api.auth import router as auth_router
from app.api.budgets import router as budgets_router
from app.api.categories import router as categories_router
from app.api.excel_import import router as excel_import_router
from app.api.expense_items import router as expense_items_router
from app.api.income import router as income_router
from app.api.summary import router as summary_router
from app.api.templates import router as templates_router

__all__ = [
    "auth_router",
    "budgets_router",
    "categories_router",
    "excel_import_router",
    "expense_items_router",
    "income_router",
    "summary_router",
    "templates_router",
]
