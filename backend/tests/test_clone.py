"""Tests for the budget clone endpoint (POST /api/budgets/{id}/clone).

This powers the recurring-expense-templates feature: cloning a budget
copies its categories, items, and income into a new budget for a new month.
"""

from decimal import Decimal


class TestBudgetClone:
    """Tests for POST /api/budgets/{id}/clone."""

    def test_clone_copies_structure_and_zeros_actuals(
        self, client, auth_headers, budget_with_data
    ):
        """Cloning copies categories/items/income; actuals are zeroed by default."""
        bid = budget_with_data["budget_id"]
        response = client.post(
            f"/api/budgets/{bid}/clone",
            json={"title": "August 2026", "month": 8, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 201
        clone = response.json()
        assert clone["title"] == "August 2026"
        assert clone["month"] == 8
        assert clone["year"] == 2026
        assert clone["id"] != bid

        # Fetch the clone's details and verify structure was copied
        detail = client.get(
            f"/api/budgets/{clone['id']}", headers=auth_headers
        ).json()
        # One income entry copied, actual zeroed
        assert len(detail["incomes"]) == 1
        assert detail["incomes"][0]["label"] == "Einkommen"
        assert Decimal(detail["incomes"][0]["projected_amount"]) == Decimal("2500.00")
        assert Decimal(detail["incomes"][0]["actual_amount"]) == Decimal("0")
        # One category copied
        assert len(detail["categories"]) == 1
        assert detail["categories"][0]["name"] == "Wohnen"
        # One item copied, actual zeroed
        assert len(detail["categories"][0]["items"]) == 1
        item = detail["categories"][0]["items"][0]
        assert item["label"] == "Miete"
        assert Decimal(item["projected_cost"]) == Decimal("900.00")
        assert Decimal(item["actual_cost"]) == Decimal("0")

    def test_clone_with_copy_actuals(
        self, client, auth_headers, budget_with_data
    ):
        """When copy_actuals=true, actual amounts are copied too."""
        bid = budget_with_data["budget_id"]
        response = client.post(
            f"/api/budgets/{bid}/clone",
            json={
                "title": "August 2026",
                "month": 8,
                "year": 2026,
                "copy_actuals": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        clone_id = response.json()["id"]

        detail = client.get(
            f"/api/budgets/{clone_id}", headers=auth_headers
        ).json()
        # Income actual copied (2500 from fixture)
        assert Decimal(detail["incomes"][0]["actual_amount"]) == Decimal("2500.00")
        # Item actual copied (850 from fixture)
        assert Decimal(
            detail["categories"][0]["items"][0]["actual_cost"]
        ) == Decimal("850.00")

    def test_clone_budget_not_found(self, client, auth_headers):
        """Cloning a non-existent budget returns 404."""
        response = client.post(
            "/api/budgets/99999/clone",
            json={"title": "Test", "month": 8, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_clone_forbidden(
        self, client, auth_headers, second_auth_headers, budget_with_data
    ):
        """Cloning another user's budget returns 403."""
        bid = budget_with_data["budget_id"]
        response = client.post(
            f"/api/budgets/{bid}/clone",
            json={"title": "Stolen", "month": 8, "year": 2026},
            headers=second_auth_headers,
        )
        assert response.status_code == 403

    def test_clone_unauthorized(self, client, budget_with_data):
        """Cloning without auth returns 401."""
        bid = budget_with_data["budget_id"]
        response = client.post(
            f"/api/budgets/{bid}/clone",
            json={"title": "Test", "month": 8, "year": 2026},
        )
        assert response.status_code == 401

    def test_clone_invalid_month(self, client, auth_headers, budget_with_data):
        """Cloning with an invalid month returns 422."""
        bid = budget_with_data["budget_id"]
        response = client.post(
            f"/api/budgets/{bid}/clone",
            json={"title": "Test", "month": 13, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 422
