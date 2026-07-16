"""Templates router — manage reusable budget templates.

A template is a named set of categories and items (with no amounts) that
can be applied to a new budget to pre-fill its structure. This saves users
from re-creating the same category layout every month.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense_item import ExpenseItem
from app.models.template import BudgetTemplate, TemplateCategory, TemplateItem
from app.models.user import User
from app.schemas.budget import BudgetResponse
from app.schemas.template import (
    BudgetTemplateCreate,
    BudgetTemplateResponse,
    BudgetTemplateUpdate,
    CreateBudgetFromTemplate,
)

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _get_user_template(db: Session, template_id: int, user: User) -> BudgetTemplate:
    """Fetch a template by ID, ensuring it belongs to the given user."""
    template = db.get(BudgetTemplate, template_id)
    if template is None:
        raise NotFoundError("Template", template_id)
    if template.user_id != user.id:
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("Template")
    return template


@router.get(
    "/",
    response_model=list[BudgetTemplateResponse],
    summary="List all budget templates",
)
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BudgetTemplate]:
    """List all templates belonging to the logged-in user."""
    stmt = select(BudgetTemplate).where(BudgetTemplate.user_id == current_user.id)
    return list(db.scalars(stmt))


@router.post(
    "/",
    response_model=BudgetTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a budget template",
)
def create_template(
    template_in: BudgetTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetTemplate:
    """Create a new budget template with categories and items."""
    template = BudgetTemplate(
        user_id=current_user.id,
        name=template_in.name,
    )
    db.add(template)
    db.flush()  # populate template.id

    for cat_index, cat_in in enumerate(template_in.categories):
        category = TemplateCategory(
            template_id=template.id,
            name=cat_in.name,
            sort_order=cat_in.sort_order if cat_in.sort_order is not None else cat_index,
        )
        db.add(category)
        db.flush()  # populate category.id

        for item_in in cat_in.items:
            db.add(
                TemplateItem(
                    category_id=category.id,
                    label=item_in.label,
                )
            )

    db.commit()
    db.refresh(template)
    return template


@router.get(
    "/{template_id}",
    response_model=BudgetTemplateResponse,
    summary="Get a budget template",
)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetTemplate:
    """Get a single budget template with its categories and items."""
    return _get_user_template(db, template_id, current_user)


@router.put(
    "/{template_id}",
    response_model=BudgetTemplateResponse,
    summary="Update a budget template's name",
)
def update_template(
    template_id: int,
    template_in: BudgetTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetTemplate:
    """Update a budget template's name."""
    template = _get_user_template(db, template_id, current_user)

    update_data = template_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return template


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a budget template",
)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a budget template and all its categories and items."""
    template = _get_user_template(db, template_id, current_user)
    db.delete(template)
    db.commit()


@router.post(
    "/{template_id}/create-budget",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a budget from a template",
)
def create_budget_from_template(
    template_id: int,
    budget_in: CreateBudgetFromTemplate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    """Create a new budget pre-filled with the template's categories and items.

    Amounts (projected and actual) are zeroed out — the template only
    defines the structure, not the numbers.
    """
    template = _get_user_template(db, template_id, current_user)

    budget = Budget(
        user_id=current_user.id,
        title=budget_in.title,
        month=budget_in.month,
        year=budget_in.year,
    )
    db.add(budget)
    db.flush()  # populate budget.id

    for category in template.categories:
        new_category = Category(
            budget_id=budget.id,
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
                    projected_cost=0,
                    actual_cost=0,
                )
            )

    db.commit()
    db.refresh(budget)
    return budget
