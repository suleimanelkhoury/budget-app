"""Categories router — add, update, and delete categories within a budget."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.ownership import get_user_budget, get_user_category

router = APIRouter(prefix="/api", tags=["categories"])


@router.post(
    "/budgets/{budget_id}/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a category to a budget",
)
def create_category(
    budget_id: int,
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Category:
    """Add a new category (e.g. Wohnen, Transport) to a budget."""
    budget = get_user_budget(db, budget_id, current_user)

    category = Category(
        budget_id=budget.id,
        name=category_in.name,
        sort_order=category_in.sort_order,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put(
    "/categories/{category_id}",
    response_model=CategoryResponse,
    summary="Update a category",
)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Category:
    """Update a category's name or sort order."""
    category = get_user_category(db, category_id, current_user)

    update_data = category_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a category and its items",
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a category and all its expense items (cascade)."""
    category = get_user_category(db, category_id, current_user)
    db.delete(category)
    db.commit()
