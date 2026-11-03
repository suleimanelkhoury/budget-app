"""Summary service — calculate budget totals and per-category subtotals."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.user import User
from app.schemas.summary import (
    BudgetComparison,
    BudgetComparisonEntry,
    BudgetSummary,
    CategorySubtotal,
    CategorySummaryResponse,
)


def _is_salary_label(label: str) -> bool:
    """Classify an income label as salary (Gehalt) vs. extra income.

    In the imported template, "Einkommen" is the actual salary while "Extra"
    holds the carryover (SOLL) and additional income like cashback, interest,
    work refunds, and tax refunds (IST).
    """
    normalized = label.strip().lower()
    return normalized in {
        "einkommen",
        "gehalt",
        "salary",
        "brutto",
        "netto",
        "nettoeinkommen",
        "bruttogehalt",
        "nettogehalt",
    }


def calculate_budget_summary(budget: Budget, db: Session) -> BudgetSummary:
    """Calculate the grand totals for a budget.

    Returns projected/actual income, expenses, balances, and differences.
    """
    # ── Income totals ──────────────────────────
    total_projected_income = sum(
        (i.projected_amount for i in budget.incomes), Decimal("0")
    )
    total_actual_income = sum((i.actual_amount for i in budget.incomes), Decimal("0"))

    # ── Income breakdown: Gehalt vs. Extra ─────
    total_projected_gehalt = sum(
        (i.projected_amount for i in budget.incomes if _is_salary_label(i.label)),
        Decimal("0"),
    )
    total_actual_gehalt = sum(
        (i.actual_amount for i in budget.incomes if _is_salary_label(i.label)),
        Decimal("0"),
    )
    total_projected_extra = total_projected_income - total_projected_gehalt
    total_actual_extra = total_actual_income - total_actual_gehalt

    # ── Expense totals ─────────────────────────
    total_projected_expenses = Decimal("0")
    total_actual_expenses = Decimal("0")

    for category in budget.categories:
        for item in category.items:
            total_projected_expenses += item.projected_cost
            total_actual_expenses += item.actual_cost

    # ── Balances (income - expenses) ───────────
    projected_balance = total_projected_income - total_projected_expenses
    actual_balance = total_actual_income - total_actual_expenses
    balance_difference = projected_balance - actual_balance

    # ── Expense difference ─────────────────────
    expense_difference = total_projected_expenses - total_actual_expenses

    return BudgetSummary(
        total_projected_income=total_projected_income,
        total_actual_income=total_actual_income,
        total_projected_gehalt=total_projected_gehalt,
        total_actual_gehalt=total_actual_gehalt,
        total_projected_extra=total_projected_extra,
        total_actual_extra=total_actual_extra,
        total_projected_expenses=total_projected_expenses,
        total_actual_expenses=total_actual_expenses,
        projected_balance=projected_balance,
        actual_balance=actual_balance,
        balance_difference=balance_difference,
        expense_difference=expense_difference,
    )


def calculate_category_summary(budget: Budget, db: Session) -> CategorySummaryResponse:
    """Calculate per-category subtotals (Zwischensumme) for a budget."""
    subtotals: list[CategorySubtotal] = []

    for category in budget.categories:
        projected_subtotal = sum(
            (item.projected_cost for item in category.items), Decimal("0")
        )
        actual_subtotal = sum(
            (item.actual_cost for item in category.items), Decimal("0")
        )
        difference = projected_subtotal - actual_subtotal

        subtotals.append(
            CategorySubtotal(
                category_id=category.id,
                category_name=category.name,
                sort_order=category.sort_order,
                item_count=len(category.items),
                projected_subtotal=projected_subtotal,
                actual_subtotal=actual_subtotal,
                difference=difference,
            )
        )

    return CategorySummaryResponse(budget_id=budget.id, categories=subtotals)


def compare_user_budgets(user: User, db: Session) -> BudgetComparison:
    """Build a multi-month comparison across all of a user's budgets.

    Budgets are returned sorted by year then month (ascending) so the
    frontend can plot them chronologically.
    """
    entries: list[BudgetComparisonEntry] = []
    for budget in user.budgets:
        summary = calculate_budget_summary(budget, db)
        entries.append(
            BudgetComparisonEntry(
                budget_id=budget.id,
                title=budget.title,
                month=budget.month,
                year=budget.year,
                total_projected_income=summary.total_projected_income,
                total_actual_income=summary.total_actual_income,
                total_projected_expenses=summary.total_projected_expenses,
                total_actual_expenses=summary.total_actual_expenses,
                projected_balance=summary.projected_balance,
                actual_balance=summary.actual_balance,
            )
        )

    # user.budgets is already ordered by year desc, month desc (see User model);
    # flip it to ascending for chronological comparison charts.
    entries.sort(key=lambda e: (e.year, e.month))
    return BudgetComparison(budgets=entries)
