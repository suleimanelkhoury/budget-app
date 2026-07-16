"""Schemas package — Pydantic request/response schemas."""

from app.schemas.auth import (
    Token,
    TokenData,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.schemas.budget import (
    BudgetCreate,
    BudgetDetail,
    BudgetResponse,
    BudgetUpdate,
)
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
)
from app.schemas.excel import ExcelImportResponse
from app.schemas.expense_item import (
    ExpenseItemCreate,
    ExpenseItemResponse,
    ExpenseItemUpdate,
)
from app.schemas.income import (
    IncomeCreate,
    IncomeResponse,
    IncomeUpdate,
)
from app.schemas.summary import (
    BudgetSummary,
    CategorySubtotal,
    CategorySummaryResponse,
    ChartData,
    ChartDataPoint,
)

# Alias to match the spec naming (Section 5 lists "CategorySummary")
CategorySummary = CategorySummaryResponse

__all__ = [
    # Auth
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "Token",
    "TokenData",
    # Budget
    "BudgetCreate",
    "BudgetUpdate",
    "BudgetResponse",
    "BudgetDetail",
    # Income
    "IncomeCreate",
    "IncomeUpdate",
    "IncomeResponse",
    # Category
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryResponse",
    # ExpenseItem
    "ExpenseItemCreate",
    "ExpenseItemUpdate",
    "ExpenseItemResponse",
    # Summary
    "BudgetSummary",
    "CategorySubtotal",
    "CategorySummary",
    "CategorySummaryResponse",
    "ChartData",
    "ChartDataPoint",
    # Excel
    "ExcelImportResponse",
]

# Resolve forward references in schemas with nested models (circular refs)

BudgetDetail.model_rebuild()
CategoryResponse.model_rebuild()
