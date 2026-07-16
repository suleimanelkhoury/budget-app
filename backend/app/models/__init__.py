"""Models package — SQLAlchemy ORM models.

Importing this package registers all models with the declarative Base metadata,
which is required for Alembic autogenerate and `Base.metadata.create_all()`.
"""

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense_item import ExpenseItem
from app.models.income import Income
from app.models.template import BudgetTemplate, TemplateCategory, TemplateItem
from app.models.user import User

__all__ = [
    "User",
    "Budget",
    "Income",
    "Category",
    "ExpenseItem",
    "BudgetTemplate",
    "TemplateCategory",
    "TemplateItem",
]
