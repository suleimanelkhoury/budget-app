"""Pydantic schemas for summary, category-summary, and chart-data endpoints."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BudgetSummary(BaseModel):
    """Grand totals for a budget — SOLL/IST/UNTERSCHIED."""

    model_config = ConfigDict(from_attributes=True)

    # Income
    total_projected_income: Decimal
    total_actual_income: Decimal

    # Income breakdown: salary (Gehalt) vs. extra (Übertrag/Zusatzeinkommen)
    total_projected_gehalt: Decimal
    total_actual_gehalt: Decimal
    total_projected_extra: Decimal
    total_actual_extra: Decimal

    # Expenses
    total_projected_expenses: Decimal
    total_actual_expenses: Decimal

    # Balance = income - expenses
    projected_balance: Decimal  # SOLL BALANCE
    actual_balance: Decimal  # IST BALANCE
    balance_difference: Decimal  # UNTERSCHIED (projected balance - actual balance)

    # Expense difference
    expense_difference: Decimal  # projected expenses - actual expenses


class CategorySubtotal(BaseModel):
    """Subtotal (Zwischensumme) for a single category."""

    model_config = ConfigDict(from_attributes=True)

    category_id: int
    category_name: str
    sort_order: int
    item_count: int
    projected_subtotal: Decimal
    actual_subtotal: Decimal
    difference: Decimal


class CategorySummaryResponse(BaseModel):
    """Per-category subtotals for a budget."""

    budget_id: int
    categories: list[CategorySubtotal]


class ChartDataPoint(BaseModel):
    """A single data point for charts (e.g. expenses by category)."""

    label: str
    projected: Decimal
    actual: Decimal


class ChartData(BaseModel):
    """Data structured for frontend charts."""

    budget_id: int
    budget_title: str
    # Bar / pie chart: expenses by category
    expenses_by_category: list[ChartDataPoint]
    # Summary numbers for comparison charts
    income_vs_expenses: ChartDataPoint


class BudgetComparisonEntry(BaseModel):
    """A single budget's totals within a multi-month comparison."""

    model_config = ConfigDict(from_attributes=True)

    budget_id: int
    title: str
    month: int
    year: int
    total_projected_income: Decimal
    total_actual_income: Decimal
    total_projected_gehalt: Decimal
    total_actual_gehalt: Decimal
    total_projected_extra: Decimal
    total_actual_extra: Decimal
    total_projected_expenses: Decimal
    total_actual_expenses: Decimal
    projected_balance: Decimal
    actual_balance: Decimal


class BudgetComparison(BaseModel):
    """Multi-month comparison of budgets belonging to a user."""

    budgets: list[BudgetComparisonEntry]


class YearlyCategoryTotal(BaseModel):
    """Aggregated total for a single category across one year."""

    name: str
    total: Decimal  # actual (IST) total spent in that category during the year


class YearlyComparisonEntry(BaseModel):
    """Aggregated totals for a single year across all of a user's budgets."""

    year: int
    total_income: Decimal  # actual income (IST)
    total_gehalt: Decimal  # actual salary (IST)
    total_extra: Decimal  # actual extra income (IST)
    total_expenses: Decimal  # actual expenses (IST)
    total_balance: Decimal  # actual balance (IST)
    invested: Decimal  # actual amount invested (Investitionen category)
    categories: list[YearlyCategoryTotal]


class YearlyComparison(BaseModel):
    """Comparison of a user's budgets aggregated by year."""

    years: list[YearlyComparisonEntry]
