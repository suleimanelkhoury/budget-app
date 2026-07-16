"""Tests for income endpoints — create, update, delete."""


class TestIncomeCreate:
    """Tests for POST /api/budgets/{id}/income."""

    def test_create_income_success(self, client, auth_headers, budget):
        """Adding an income entry to a budget works."""
        response = client.post(
            f"/api/budgets/{budget['id']}/income",
            json={
                "label": "Einkommen",
                "projected_amount": "2500",
                "actual_amount": "2500",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["label"] == "Einkommen"
        assert data["projected_amount"] == "2500.00"
        assert data["actual_amount"] == "2500.00"
        assert data["difference"] == "0.00"
        assert data["budget_id"] == budget["id"]

    def test_create_income_default_amounts(self, client, auth_headers, budget):
        """Income with no amounts defaults to 0."""
        response = client.post(
            f"/api/budgets/{budget['id']}/income",
            json={"label": "Extra"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["projected_amount"] == "0.00"
        assert response.json()["actual_amount"] == "0.00"

    def test_create_income_budget_not_found(self, client, auth_headers):
        """Adding income to a non-existent budget returns 404."""
        response = client.post(
            "/api/budgets/99999/income",
            json={"label": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_create_income_forbidden(
        self, client, auth_headers, second_auth_headers, budget
    ):
        """Adding income to another user's budget returns 403."""
        response = client.post(
            f"/api/budgets/{budget['id']}/income",
            json={"label": "Test"},
            headers=second_auth_headers,
        )
        assert response.status_code == 403


class TestIncomeUpdate:
    """Tests for PUT /api/income/{id}."""

    def test_update_income_amounts(self, client, auth_headers, budget_with_data):
        """Updating projected and actual amounts works."""
        iid = budget_with_data["income_id"]
        response = client.put(
            f"/api/income/{iid}",
            json={"projected_amount": "3000", "actual_amount": "2800"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projected_amount"] == "3000.00"
        assert data["actual_amount"] == "2800.00"
        assert data["difference"] == "200.00"

    def test_update_income_label(self, client, auth_headers, budget_with_data):
        """Updating just the label works."""
        iid = budget_with_data["income_id"]
        response = client.put(
            f"/api/income/{iid}",
            json={"label": "Gehalt"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["label"] == "Gehalt"

    def test_update_income_not_found(self, client, auth_headers):
        """Updating a non-existent income returns 404."""
        response = client.put(
            "/api/income/99999",
            json={"label": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestIncomeDelete:
    """Tests for DELETE /api/income/{id}."""

    def test_delete_income_success(self, client, auth_headers, budget_with_data):
        """Deleting an income entry returns 204."""
        iid = budget_with_data["income_id"]
        response = client.delete(f"/api/income/{iid}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        response = client.put(
            f"/api/income/{iid}",
            json={"label": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_income_not_found(self, client, auth_headers):
        """Deleting a non-existent income returns 404."""
        response = client.delete("/api/income/99999", headers=auth_headers)
        assert response.status_code == 404
