"""Summary & reports router — budget totals, category subtotals, and chart data."""

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.summary import (
    BudgetSummary,
    CategorySummaryResponse,
    ChartData,
    ChartDataPoint,
)
from app.services.ownership import get_user_budget
from app.services.summary import (
    calculate_budget_summary,
    calculate_category_summary,
)

router = APIRouter(prefix="/api/budgets", tags=["summary"])


@router.get(
    "/{budget_id}/summary",
    response_model=BudgetSummary,
    summary="Get budget totals (SOLL/IST/UNTERSCHIED)",
)
def get_budget_summary(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetSummary:
    """Return the grand totals for a budget:
    projected/actual income & expenses, balances, and differences.
    """
    budget = get_user_budget(db, budget_id, current_user)
    return calculate_budget_summary(budget, db)


@router.get(
    "/{budget_id}/category-summary",
    response_model=CategorySummaryResponse,
    summary="Get per-category subtotals (Zwischensumme)",
)
def get_category_summary(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategorySummaryResponse:
    """Return subtotals for each category in a budget."""
    budget = get_user_budget(db, budget_id, current_user)
    return calculate_category_summary(budget, db)


@router.get(
    "/{budget_id}/chart-data",
    response_model=ChartData,
    summary="Get data structured for frontend charts",
)
def get_chart_data(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartData:
    """Return chart-ready data: expenses by category and income vs. expenses."""
    budget = get_user_budget(db, budget_id, current_user)
    summary = calculate_budget_summary(budget, db)

    # Expenses by category (for bar/pie charts)
    expenses_by_category: list[ChartDataPoint] = []
    for category in budget.categories:
        projected = sum((item.projected_cost for item in category.items), Decimal("0"))
        actual = sum((item.actual_cost for item in category.items), Decimal("0"))
        expenses_by_category.append(
            ChartDataPoint(
                label=category.name,
                projected=projected,
                actual=actual,
            )
        )

    # Income vs. expenses (for comparison charts)
    income_vs_expenses = ChartDataPoint(
        label="Income vs Expenses",
        projected=summary.total_projected_income - summary.total_projected_expenses,
        actual=summary.total_actual_income - summary.total_actual_expenses,
    )

    return ChartData(
        budget_id=budget.id,
        budget_title=budget.title,
        expenses_by_category=expenses_by_category,
        income_vs_expenses=income_vs_expenses,
    )
