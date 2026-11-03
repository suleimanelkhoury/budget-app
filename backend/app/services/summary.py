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
    YearlyCategoryTotal,
    YearlyComparison,
    YearlyComparisonEntry,
)


def _is_investment_category(name: str) -> bool:
    """Return True if a category represents investments (Investitionen).

    The imported template's "Investitionen" category holds the amounts the
    user put into their portfolio (MSCI World, MSCI Emerging Market, BYD, …).
    """
    return name.strip().lower() in {"investitionen", "investments"}


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


def _income_totals(budget: Budget) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Return (projected, actual, projected_salary, actual_salary) income totals."""
    projected = sum((i.projected_amount for i in budget.incomes), Decimal("0"))
    actual = sum((i.actual_amount for i in budget.incomes), Decimal("0"))
    projected_gehalt = sum(
        (i.projected_amount for i in budget.incomes if _is_salary_label(i.label)),
        Decimal("0"),
    )
    actual_gehalt = sum(
        (i.actual_amount for i in budget.incomes if _is_salary_label(i.label)),
        Decimal("0"),
    )
    return projected, actual, projected_gehalt, actual_gehalt


def calculate_budget_summary(budget: Budget, db: Session) -> BudgetSummary:
    """Calculate the grand totals for a budget.

    Returns projected/actual income, expenses, balances, and differences.
    """
    # ── Income totals ──────────────────────────
    (
        total_projected_income,
        total_actual_income,
        total_projected_gehalt,
        total_actual_gehalt,
    ) = _income_totals(budget)

    # ── Income breakdown: Gehalt vs. Extra ─────
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
                total_projected_gehalt=summary.total_projected_gehalt,
                total_actual_gehalt=summary.total_actual_gehalt,
                total_projected_extra=summary.total_projected_extra,
                total_actual_extra=summary.total_actual_extra,
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


def compare_user_by_year(user: User, db: Session) -> YearlyComparison:
    """Aggregate a user's budgets by calendar year.

    For each year, returns total income (split into salary/carryover),
    expenses, balance, the amount invested (Investitionen category), and a
    per-category breakdown of actual (IST) spending.
    """
    # year -> dict of accumulators
    by_year: dict[int, dict] = {}

    for budget in user.budgets:
        acc = by_year.setdefault(
            budget.year,
            {
                "income": Decimal("0"),
                "gehalt": Decimal("0"),
                "extra": Decimal("0"),
                "expenses": Decimal("0"),
                "balance": Decimal("0"),
                "invested": Decimal("0"),
                "categories": {},  # name.lower() -> [display_name, Decimal]
            },
        )

        income = sum((i.actual_amount for i in budget.incomes), Decimal("0"))
        gehalt = sum(
            (i.actual_amount for i in budget.incomes if _is_salary_label(i.label)),
            Decimal("0"),
        )
        acc["income"] += income
        acc["gehalt"] += gehalt
        acc["extra"] += income - gehalt

        expenses = Decimal("0")
        for category in budget.categories:
            cat_total = sum(
                (item.actual_cost for item in category.items), Decimal("0")
            )
            expenses += cat_total
            if _is_investment_category(category.name):
                acc["invested"] += cat_total
            key = category.name.lower()
            entry = acc["categories"].get(key)
            if entry is None:
                acc["categories"][key] = [category.name, cat_total]
            else:
                entry[1] += cat_total

        acc["expenses"] += expenses
        acc["balance"] += income - expenses

    years: list[YearlyComparisonEntry] = []
    for y, acc in sorted(by_year.items(), key=lambda kv: kv[0]):
        categories = [
            YearlyCategoryTotal(name=name, total=total)
            for name, total in sorted(
                acc["categories"].values(), key=lambda e: e[1], reverse=True
            )
        ]
        years.append(
            YearlyComparisonEntry(
                year=y,
                total_income=acc["income"],
                total_gehalt=acc["gehalt"],
                total_extra=acc["extra"],
                total_expenses=acc["expenses"],
                total_balance=acc["balance"],
                invested=acc["invested"],
                categories=categories,
            )
        )

    return YearlyComparison(years=years)
