"""Budgets router — CRUD endpoints for monthly budgets."""

from decimal import Decimal

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense_item import ExpenseItem
from app.models.income import Income
from app.models.user import User
from app.schemas.budget import (
    BudgetClone,
    BudgetCreate,
    BudgetDetail,
    BudgetResponse,
    BudgetUpdate,
)
from app.schemas.summary import BudgetComparison
from app.services.ownership import get_user_budget
from app.services.summary import compare_user_budgets

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("/", response_model=list[BudgetResponse], summary="List all budgets")
def list_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Budget]:
    """List all budgets belonging to the logged-in user."""
    stmt = select(Budget).where(Budget.user_id == current_user.id)
    return list(db.scalars(stmt))


@router.get(
    "/compare",
    response_model=BudgetComparison,
    summary="Compare all budgets across months",
)
def compare_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetComparison:
    """Return totals for every budget belonging to the logged-in user.

    Used by the multi-month comparison view to plot income, expenses, and
    balance trends over time. Budgets are sorted chronologically.
    """
    return compare_user_budgets(current_user, db)


@router.post(
    "/",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new budget",
)
def create_budget(
    budget_in: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    """Create a new monthly budget for the logged-in user."""
    budget = Budget(
        user_id=current_user.id,
        title=budget_in.title,
        month=budget_in.month,
        year=budget_in.year,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.get(
    "/{budget_id}",
    response_model=BudgetDetail,
    summary="Get a budget with all details",
)
def get_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    """Get a single budget with all its categories, items, and income."""
    return get_user_budget(db, budget_id, current_user)


@router.put(
    "/{budget_id}",
    response_model=BudgetResponse,
    summary="Update a budget",
)
def update_budget(
    budget_id: int,
    budget_in: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    """Update a budget's title, month, or year."""
    budget = get_user_budget(db, budget_id, current_user)

    update_data = budget_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    db.commit()
    db.refresh(budget)
    return budget


@router.delete(
    "/{budget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a budget",
)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a budget and all related categories, items, and income."""
    budget = get_user_budget(db, budget_id, current_user)
    db.delete(budget)
    db.commit()


def _clone_budget(
    source: Budget,
    *,
    title: str,
    month: int,
    year: int,
    copy_actuals: bool,
    db: Session,
) -> Budget:
    """Create a new budget that mirrors `source`'s categories, items, and income.

    When `copy_actuals` is False (the default for recurring templates), the
    new budget's actual columns are zeroed out so the user can fill them in
    for the new month. Projected values are always copied — this is what makes
    the clone act as a "recurring expense template".
    """
    clone = Budget(
        user_id=source.user_id,
        title=title,
        month=month,
        year=year,
    )
    db.add(clone)
    db.flush()  # populate clone.id

    # ── Clone income ───────────────────────────
    for income in source.incomes:
        db.add(
            Income(
                budget_id=clone.id,
                label=income.label,
                projected_amount=income.projected_amount,
                actual_amount=income.actual_amount if copy_actuals else Decimal("0"),
            )
        )

    # ── Clone categories + items ───────────────
    for category in source.categories:
        new_category = Category(
            budget_id=clone.id,
            name=category.name,
            sort_order=category.sort_order,
        )
        db.add(new_category)
        db.flush()  # populate new_category.id

        for item in category.items:
            db.add(
                ExpenseItem(
                    category_id=new_category.id,
                    label=item.label,
                    projected_cost=item.projected_cost,
                    actual_cost=item.actual_cost if copy_actuals else Decimal("0"),
                )
            )

    db.commit()
    db.refresh(clone)
    return clone


@router.post(
    "/{budget_id}/clone",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Clone a budget for a new month (recurring template)",
)
def clone_budget(
    budget_id: int,
    clone_in: BudgetClone,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    """Create a new budget from an existing one.

    This powers the "recurring expense templates" feature: the source
    budget's categories, items, and income are copied so the user doesn't
    have to re-enter recurring expenses each month. By default actual
    amounts are zeroed out; pass `copy_actuals=true` to duplicate them too.
    """
    source = get_user_budget(db, budget_id, current_user)
    return _clone_budget(
        source,
        title=clone_in.title,
        month=clone_in.month,
        year=clone_in.year,
        copy_actuals=clone_in.copy_actuals,
        db=db,
    )
