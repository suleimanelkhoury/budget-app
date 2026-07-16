"""Income router — add, update, and delete income entries within a budget."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.income import Income
from app.models.user import User
from app.schemas.income import IncomeCreate, IncomeResponse, IncomeUpdate
from app.services.ownership import get_user_budget, get_user_income

router = APIRouter(prefix="/api", tags=["income"])


@router.post(
    "/budgets/{budget_id}/income",
    response_model=IncomeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an income entry to a budget",
)
def create_income(
    budget_id: int,
    income_in: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Income:
    """Add a new income entry (e.g. Einkommen, Extra) to a budget."""
    budget = get_user_budget(db, budget_id, current_user)

    income = Income(
        budget_id=budget.id,
        label=income_in.label,
        projected_amount=income_in.projected_amount,
        actual_amount=income_in.actual_amount,
    )
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@router.put(
    "/income/{income_id}",
    response_model=IncomeResponse,
    summary="Update an income entry",
)
def update_income(
    income_id: int,
    income_in: IncomeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Income:
    """Update an income entry's label, projected, or actual amount."""
    income = get_user_income(db, income_id, current_user)

    update_data = income_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(income, field, value)

    db.commit()
    db.refresh(income)
    return income


@router.delete(
    "/income/{income_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an income entry",
)
def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an income entry from a budget."""
    income = get_user_income(db, income_id, current_user)
    db.delete(income)
    db.commit()
