"""Expense items router — add, update, and delete items within a category."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.expense_item import ExpenseItem
from app.models.user import User
from app.schemas.expense_item import (
    ExpenseItemCreate,
    ExpenseItemResponse,
    ExpenseItemUpdate,
)
from app.services.ownership import get_user_category, get_user_expense_item

router = APIRouter(prefix="/api", tags=["expense-items"])


@router.post(
    "/categories/{category_id}/items",
    response_model=ExpenseItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an expense item to a category",
)
def create_expense_item(
    category_id: int,
    item_in: ExpenseItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpenseItem:
    """Add a new expense item (e.g. Miete, Strom) to a category."""
    category = get_user_category(db, category_id, current_user)

    item = ExpenseItem(
        category_id=category.id,
        label=item_in.label,
        projected_cost=item_in.projected_cost,
        actual_cost=item_in.actual_cost,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put(
    "/items/{item_id}",
    response_model=ExpenseItemResponse,
    summary="Update an expense item",
)
def update_expense_item(
    item_id: int,
    item_in: ExpenseItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpenseItem:
    """Update an expense item's label, projected cost, or actual cost."""
    item = get_user_expense_item(db, item_id, current_user)

    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expense item",
)
def delete_expense_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an expense item from a category."""
    item = get_user_expense_item(db, item_id, current_user)
    db.delete(item)
    db.commit()
