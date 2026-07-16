"""Tests for summary, category-summary, and chart-data endpoints."""

from decimal import Decimal

import pytest


@pytest.fixture()
def budget_with_full_data(client, auth_headers, budget):
    """Create a budget with multiple incomes, categories, and items for summary tests."""
    bid = budget["id"]

    # Two income entries
    client.post(
        f"/api/budgets/{bid}/income",
        json={
            "label": "Einkommen",
            "projected_amount": "2500",
            "actual_amount": "2600",
        },
        headers=auth_headers,
    )
    client.post(
        f"/api/budgets/{bid}/income",
        json={"label": "Extra", "projected_amount": "300", "actual_amount": "200"},
        headers=auth_headers,
    )

    # Category 1: Wohnen
    r = client.post(
        f"/api/budgets/{bid}/categories",
        json={"name": "Wohnen", "sort_order": 0},
        headers=auth_headers,
    )
    cat1 = r.json()["id"]
    client.post(
        f"/api/categories/{cat1}/items",
        json={"label": "Miete", "projected_cost": "900", "actual_cost": "900"},
        headers=auth_headers,
    )
    client.post(
        f"/api/categories/{cat1}/items",
        json={"label": "Strom", "projected_cost": "80", "actual_cost": "75"},
        headers=auth_headers,
    )

    # Category 2: Essen
    r = client.post(
        f"/api/budgets/{bid}/categories",
        json={"name": "Essen", "sort_order": 1},
        headers=auth_headers,
    )
    cat2 = r.json()["id"]
    client.post(
        f"/api/categories/{cat2}/items",
        json={"label": "Lebensmittel", "projected_cost": "400", "actual_cost": "450"},
        headers=auth_headers,
    )

    return bid


class TestBudgetSummary:
    """Tests for GET /api/budgets/{id}/summary."""

    def test_summary_totals(self, client, auth_headers, budget_with_full_data):
        """Summary returns correct projected/actual income, expenses, and balances."""
        bid = budget_with_full_data
        response = client.get(f"/api/budgets/{bid}/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Income: 2500 + 300 = 2800 projected, 2600 + 200 = 2800 actual
        assert Decimal(data["total_projected_income"]) == Decimal("2800.00")
        assert Decimal(data["total_actual_income"]) == Decimal("2800.00")

        # Expenses: 900 + 80 + 400 = 1380 projected, 900 + 75 + 450 = 1425 actual
        assert Decimal(data["total_projected_expenses"]) == Decimal("1380.00")
        assert Decimal(data["total_actual_expenses"]) == Decimal("1425.00")

        # Balance: 2800 - 1380 = 1420 projected, 2800 - 1425 = 1375 actual
        assert Decimal(data["projected_balance"]) == Decimal("1420.00")
        assert Decimal(data["actual_balance"]) == Decimal("1375.00")

        # Balance difference: 1420 - 1375 = 45
        assert Decimal(data["balance_difference"]) == Decimal("45.00")

        # Expense difference: 1380 - 1425 = -45
        assert Decimal(data["expense_difference"]) == Decimal("-45.00")

    def test_summary_empty_budget(self, client, auth_headers, budget):
        """Summary of a budget with no data returns all zeros."""
        response = client.get(
            f"/api/budgets/{budget['id']}/summary", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert Decimal(data["total_projected_income"]) == Decimal("0")
        assert Decimal(data["total_actual_income"]) == Decimal("0")
        assert Decimal(data["total_projected_expenses"]) == Decimal("0")
        assert Decimal(data["total_actual_expenses"]) == Decimal("0")
        assert Decimal(data["projected_balance"]) == Decimal("0")
        assert Decimal(data["actual_balance"]) == Decimal("0")

    def test_summary_not_found(self, client, auth_headers):
        """Summary of a non-existent budget returns 404."""
        response = client.get("/api/budgets/99999/summary", headers=auth_headers)
        assert response.status_code == 404

    def test_summary_forbidden(self, client, auth_headers, second_auth_headers, budget):
        """Summary of another user's budget returns 403."""
        response = client.get(
            f"/api/budgets/{budget['id']}/summary", headers=second_auth_headers
        )
        assert response.status_code == 403


class TestCategorySummary:
    """Tests for GET /api/budgets/{id}/category-summary."""

    def test_category_subtotals(self, client, auth_headers, budget_with_full_data):
        """Category summary returns correct per-category subtotals."""
        bid = budget_with_full_data
        response = client.get(
            f"/api/budgets/{bid}/category-summary", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["budget_id"] == bid
        assert len(data["categories"]) == 2

        # Wohnen: 900 + 80 = 980 projected, 900 + 75 = 975 actual, diff = 5
        wohnen = data["categories"][0]
        assert wohnen["category_name"] == "Wohnen"
        assert wohnen["item_count"] == 2
        assert Decimal(wohnen["projected_subtotal"]) == Decimal("980.00")
        assert Decimal(wohnen["actual_subtotal"]) == Decimal("975.00")
        assert Decimal(wohnen["difference"]) == Decimal("5.00")

        # Essen: 400 projected, 450 actual, diff = -50
        essen = data["categories"][1]
        assert essen["category_name"] == "Essen"
        assert Decimal(essen["projected_subtotal"]) == Decimal("400.00")
        assert Decimal(essen["actual_subtotal"]) == Decimal("450.00")
        assert Decimal(essen["difference"]) == Decimal("-50.00")

    def test_category_summary_empty(self, client, auth_headers, budget):
        """Category summary of an empty budget returns no categories."""
        response = client.get(
            f"/api/budgets/{budget['id']}/category-summary", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["categories"] == []


class TestChartData:
    """Tests for GET /api/budgets/{id}/chart-data."""

    def test_chart_data_structure(self, client, auth_headers, budget_with_full_data):
        """Chart data has the correct structure for frontend charts."""
        bid = budget_with_full_data
        response = client.get(f"/api/budgets/{bid}/chart-data", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["budget_id"] == bid
        assert data["budget_title"] == "Test Month"
        assert len(data["expenses_by_category"]) == 2

        # Check expenses by category
        wohnen = data["expenses_by_category"][0]
        assert wohnen["label"] == "Wohnen"
        assert Decimal(wohnen["projected"]) == Decimal("980.00")
        assert Decimal(wohnen["actual"]) == Decimal("975.00")

        # Check income vs expenses
        ive = data["income_vs_expenses"]
        assert ive["label"] == "Income vs Expenses"
        # projected: 2800 - 1380 = 1420
        assert Decimal(ive["projected"]) == Decimal("1420.00")
        # actual: 2800 - 1425 = 1375
        assert Decimal(ive["actual"]) == Decimal("1375.00")
