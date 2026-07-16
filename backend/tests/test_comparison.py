"""Tests for the multi-month comparison endpoint (GET /api/budgets/compare)."""

from decimal import Decimal


class TestBudgetCompare:
    """Tests for GET /api/budgets/compare."""

    def test_compare_empty(self, client, auth_headers):
        """A user with no budgets gets an empty comparison list."""
        response = client.get("/api/budgets/compare", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"budgets": []}

    def test_compare_single_budget(self, client, auth_headers, budget_with_data):
        """Comparison with one budget returns that budget's totals."""
        response = client.get("/api/budgets/compare", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["budgets"]) == 1
        entry = data["budgets"][0]
        assert entry["budget_id"] == budget_with_data["budget_id"]
        # Income: 2500 projected, 2500 actual (from budget_with_data fixture)
        assert Decimal(entry["total_projected_income"]) == Decimal("2500.00")
        assert Decimal(entry["total_actual_income"]) == Decimal("2500.00")
        # Expenses: Miete 900/850
        assert Decimal(entry["total_projected_expenses"]) == Decimal("900.00")
        assert Decimal(entry["total_actual_expenses"]) == Decimal("850.00")

    def test_compare_multiple_budgets_chronological(
        self, client, auth_headers, budget_with_data
    ):
        """Multiple budgets are returned sorted by year then month ascending."""
        # budget_with_data is July 2026 (month=7, year=2026)
        # Create an earlier budget (June 2026) and a later one (August 2026)
        client.post(
            "/api/budgets/",
            json={"title": "Juni 2026", "month": 6, "year": 2026},
            headers=auth_headers,
        )
        client.post(
            "/api/budgets/",
            json={"title": "August 2026", "month": 8, "year": 2026},
            headers=auth_headers,
        )

        response = client.get("/api/budgets/compare", headers=auth_headers)
        assert response.status_code == 200
        entries = response.json()["budgets"]
        assert len(entries) == 3
        # Sorted ascending by (year, month)
        assert entries[0]["month"] == 6
        assert entries[1]["month"] == 7
        assert entries[2]["month"] == 8

    def test_compare_only_own_budgets(
        self, client, auth_headers, second_auth_headers, budget_with_data
    ):
        """A user only sees their own budgets in the comparison."""
        # Second user creates a budget
        client.post(
            "/api/budgets/",
            json={"title": "Other User Budget", "month": 1, "year": 2026},
            headers=second_auth_headers,
        )

        # First user's comparison should only contain their budget
        response = client.get("/api/budgets/compare", headers=auth_headers)
        assert response.status_code == 200
        entries = response.json()["budgets"]
        assert len(entries) == 1
        assert entries[0]["budget_id"] == budget_with_data["budget_id"]

    def test_compare_unauthorized(self, client):
        """Comparing budgets without auth returns 401."""
        response = client.get("/api/budgets/compare")
        assert response.status_code == 401
