"""Service helper — bump a budget's "last edited" (updated_at) timestamp.

A budget is edited through its children (categories, expense items, income
rows) at least as often as through the budget row itself, so every mutating
endpoint calls one of these helpers before committing. The budget row's
`onupdate` covers direct budget edits (rename, month, year) automatically.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.budget import Budget


def touch_budget(db: Session, budget: Budget) -> None:
    """Mark the given budget as edited now.

    Assigning the SQL `now()` expression (instead of a Python datetime)
    keeps the stamp on the database clock — consistent with the
    server_default values used for created_at/updated_at.
    """
    budget.updated_at = func.now()


def touch_budget_by_id(db: Session, budget_id: int) -> None:
    """Mark the budget with the given ID as edited now.

    Used by endpoints that mutate a child (category, item, income) and
    only hold its `budget_id`. Silently does nothing if the budget is
    already gone (a concurrent delete), so it can never mask the actual
    mutation's result.
    """
    budget = db.get(Budget, budget_id)
    if budget is not None:
        budget.updated_at = func.now()
