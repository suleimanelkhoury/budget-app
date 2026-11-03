"""Shared service helpers — ownership checks and common queries.

All functions raise AppException subclasses (NotFoundError, ForbiddenError)
which carry both German and English messages. The global exception handler
picks the language based on the Accept-Language header.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense_item import ExpenseItem
from app.models.income import Income
from app.models.template import BudgetTemplate
from app.models.user import User


def get_user_budget(db: Session, budget_id: int, user: User) -> Budget:
    """Fetch a budget by ID, ensuring it belongs to the given user.

    Raises NotFoundError (404) if the budget doesn't exist.
    Raises ForbiddenError (403) if it belongs to another user.
    """
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise NotFoundError("Budget", budget_id)
    if budget.user_id != user.id:
        raise ForbiddenError("Budget")
    return budget


def get_user_category(db: Session, category_id: int, user: User) -> Category:
    """Fetch a category by ID, ensuring its budget belongs to the given user."""
    category = db.get(Category, category_id)
    if category is None:
        raise NotFoundError("Category", category_id)
    # Walk up to the budget to check ownership
    budget = db.get(Budget, category.budget_id)
    if budget is None or budget.user_id != user.id:
        raise ForbiddenError("Category")
    return category


def get_user_income(db: Session, income_id: int, user: User) -> Income:
    """Fetch an income entry by ID, ensuring its budget belongs to the given user."""
    income = db.get(Income, income_id)
    if income is None:
        raise NotFoundError("Income", income_id)
    budget = db.get(Budget, income.budget_id)
    if budget is None or budget.user_id != user.id:
        raise ForbiddenError("Income")
    return income


def get_user_expense_item(db: Session, item_id: int, user: User) -> ExpenseItem:
    """Fetch an expense item by ID, ensuring its budget belongs to the given user."""
    item = db.get(ExpenseItem, item_id)
    if item is None:
        raise NotFoundError("Expense item", item_id)
    category = db.get(Category, item.category_id)
    if category is None:
        raise NotFoundError("Expense item", item_id)
    budget = db.get(Budget, category.budget_id)
    if budget is None or budget.user_id != user.id:
        raise ForbiddenError("Expense item")
    return item


def get_user_template(db: Session, template_id: int, user: User) -> BudgetTemplate:
    """Fetch a budget template by ID, ensuring it belongs to the given user.

    Raises NotFoundError (404) if the template doesn't exist.
    Raises ForbiddenError (403) if it belongs to another user.
    """
    template = db.get(BudgetTemplate, template_id)
    if template is None:
        raise NotFoundError("Template", template_id)
    if template.user_id != user.id:
        raise ForbiddenError("Template")
    return template
