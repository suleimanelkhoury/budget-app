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


class TestBudgetCompareYearly:
    """Tests for GET /api/budgets/compare-yearly."""

    def test_compare_yearly_empty(self, client, auth_headers):
        """A user with no budgets gets an empty yearly comparison."""
        response = client.get("/api/budgets/compare-yearly", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"years": []}

    def test_compare_yearly_unauthorized(self, client):
        """Yearly comparison without auth returns 401."""
        response = client.get("/api/budgets/compare-yearly")
        assert response.status_code == 401

    def test_compare_yearly_aggregates_categories(
        self, client, auth_headers, budget_with_data
    ):
        """Expenses are aggregated per year, including the invested amount."""
        bid = budget_with_data["budget_id"]

        # Add an Investitionen category with an actual amount
        r = client.post(
            f"/api/budgets/{bid}/categories",
            json={"name": "Investitionen", "sort_order": 1},
            headers=auth_headers,
        )
        cat_id = r.json()["id"]
        client.post(
            f"/api/categories/{cat_id}/items",
            json={"label": "MSCI World", "projected_cost": "500", "actual_cost": "400"},
            headers=auth_headers,
        )

        response = client.get("/api/budgets/compare-yearly", headers=auth_headers)
        assert response.status_code == 200
        years = response.json()["years"]
        assert len(years) == 1
        entry = years[0]
        # Income: Einkommen actual 2500 (salary)
        assert Decimal(entry["total_income"]) == Decimal("2500.00")
        assert Decimal(entry["total_gehalt"]) == Decimal("2500.00")
        assert Decimal(entry["total_extra"]) == Decimal("0.00")
        # Expenses: Miete 850 + MSCI World 400
        assert Decimal(entry["total_expenses"]) == Decimal("1250.00")
        assert Decimal(entry["invested"]) == Decimal("400.00")
        assert Decimal(entry["total_balance"]) == Decimal("1250.00")  # 2500 - 1250

        # Categories include both Wohnen (Miete) and Investitionen
        cat_names = {c["name"]: Decimal(c["total"]) for c in entry["categories"]}
        assert cat_names["Wohnen"] == Decimal("850.00")
        assert cat_names["Investitionen"] == Decimal("400.00")

    def test_compare_yearly_groups_by_year(
        self, client, auth_headers, budget_with_data
    ):
        """Budgets from different years are grouped into separate entries."""
        # budget_with_data is July 2026 with income 2500 and expense 850
        # Create a budget in 2025 with the same data
        client.post(
            "/api/budgets/",
            json={"title": "Juli 2025", "month": 7, "year": 2025},
            headers=auth_headers,
        )
        r = client.post(
            "/api/budgets/",
            json={"title": "Dezember 2025", "month": 12, "year": 2025},
            headers=auth_headers,
        )
        bid2025 = r.json()["id"]
        client.post(
            f"/api/budgets/{bid2025}/income",
            json={"label": "Extra", "projected_amount": "100", "actual_amount": "50"},
            headers=auth_headers,
        )

        response = client.get("/api/budgets/compare-yearly", headers=auth_headers)
        years = response.json()["years"]
        assert [y["year"] for y in years] == [2025, 2026]
        # 2025: only Extra income (50), no expenses
        y2025 = next(y for y in years if y["year"] == 2025)
        assert Decimal(y2025["total_income"]) == Decimal("50.00")
        assert Decimal(y2025["total_extra"]) == Decimal("50.00")
        assert Decimal(y2025["total_gehalt"]) == Decimal("0.00")
