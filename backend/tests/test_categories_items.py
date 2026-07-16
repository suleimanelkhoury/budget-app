"""Tests for category and expense item CRUD endpoints."""


# ── Category tests ────────────────────────────
class TestCategoryCreate:
    """Tests for POST /api/budgets/{id}/categories."""

    def test_create_category_success(self, client, auth_headers, budget):
        """Adding a category to a budget works."""
        response = client.post(
            f"/api/budgets/{budget['id']}/categories",
            json={"name": "Wohnen", "sort_order": 0},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Wohnen"
        assert data["sort_order"] == 0
        assert data["budget_id"] == budget["id"]
        assert data["items"] == []

    def test_create_category_default_sort_order(self, client, auth_headers, budget):
        """Sort order defaults to 0."""
        response = client.post(
            f"/api/budgets/{budget['id']}/categories",
            json={"name": "Transport"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["sort_order"] == 0

    def test_create_category_budget_not_found(self, client, auth_headers):
        """Adding a category to a non-existent budget returns 404."""
        response = client.post(
            "/api/budgets/99999/categories",
            json={"name": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_create_category_forbidden(
        self, client, auth_headers, second_auth_headers, budget
    ):
        """Adding a category to another user's budget returns 403."""
        response = client.post(
            f"/api/budgets/{budget['id']}/categories",
            json={"name": "Test"},
            headers=second_auth_headers,
        )
        assert response.status_code == 403


class TestCategoryUpdate:
    """Tests for PUT /api/categories/{id}."""

    def test_update_category_name(self, client, auth_headers, budget_with_data):
        """Updating a category name works."""
        cid = budget_with_data["category_id"]
        response = client.put(
            f"/api/categories/{cid}",
            json={"name": "Wohnen & Utilities"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Wohnen & Utilities"

    def test_update_category_sort_order(self, client, auth_headers, budget_with_data):
        """Updating sort order works."""
        cid = budget_with_data["category_id"]
        response = client.put(
            f"/api/categories/{cid}",
            json={"sort_order": 5},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["sort_order"] == 5

    def test_update_category_not_found(self, client, auth_headers):
        """Updating a non-existent category returns 404."""
        response = client.put(
            "/api/categories/99999",
            json={"name": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestCategoryDelete:
    """Tests for DELETE /api/categories/{id}."""

    def test_delete_category_success(self, client, auth_headers, budget_with_data):
        """Deleting a category returns 204."""
        cid = budget_with_data["category_id"]
        response = client.delete(f"/api/categories/{cid}", headers=auth_headers)
        assert response.status_code == 204

    def test_delete_category_cascades_items(
        self, client, auth_headers, budget_with_data
    ):
        """Deleting a category also removes its expense items."""
        cid = budget_with_data["category_id"]
        item_id = budget_with_data["item_id"]

        client.delete(f"/api/categories/{cid}", headers=auth_headers)

        # The item should be gone
        response = client.put(
            f"/api/items/{item_id}",
            json={"label": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_category_not_found(self, client, auth_headers):
        """Deleting a non-existent category returns 404."""
        response = client.delete("/api/categories/99999", headers=auth_headers)
        assert response.status_code == 404


# ── Expense item tests ────────────────────────
class TestExpenseItemCreate:
    """Tests for POST /api/categories/{id}/items."""

    def test_create_item_success(self, client, auth_headers, budget_with_data):
        """Adding an expense item to a category works."""
        cid = budget_with_data["category_id"]
        response = client.post(
            f"/api/categories/{cid}/items",
            json={"label": "Strom", "projected_cost": "80", "actual_cost": "75"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["label"] == "Strom"
        assert data["projected_cost"] == "80.00"
        assert data["actual_cost"] == "75.00"
        assert data["difference"] == "5.00"
        assert data["category_id"] == cid

    def test_create_item_default_costs(self, client, auth_headers, budget_with_data):
        """Item with no costs defaults to 0."""
        cid = budget_with_data["category_id"]
        response = client.post(
            f"/api/categories/{cid}/items",
            json={"label": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["projected_cost"] == "0.00"
        assert response.json()["actual_cost"] == "0.00"

    def test_create_item_category_not_found(self, client, auth_headers):
        """Adding an item to a non-existent category returns 404."""
        response = client.post(
            "/api/categories/99999/items",
            json={"label": "Test"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestExpenseItemUpdate:
    """Tests for PUT /api/items/{id}."""

    def test_update_item_costs(self, client, auth_headers, budget_with_data):
        """Updating projected and actual costs works."""
        item_id = budget_with_data["item_id"]
        response = client.put(
            f"/api/items/{item_id}",
            json={"projected_cost": "1000", "actual_cost": "950"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["projected_cost"] == "1000.00"
        assert data["actual_cost"] == "950.00"
        assert data["difference"] == "50.00"

    def test_update_item_label(self, client, auth_headers, budget_with_data):
        """Updating just the label works."""
        item_id = budget_with_data["item_id"]
        response = client.put(
            f"/api/items/{item_id}",
            json={"label": "Warmmiete"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["label"] == "Warmmiete"

    def test_update_item_not_found(self, client, auth_headers):
        """Updating a non-existent item returns 404."""
        response = client.put(
            "/api/items/99999",
            json={"label": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestExpenseItemDelete:
    """Tests for DELETE /api/items/{id}."""

    def test_delete_item_success(self, client, auth_headers, budget_with_data):
        """Deleting an expense item returns 204."""
        item_id = budget_with_data["item_id"]
        response = client.delete(f"/api/items/{item_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        response = client.put(
            f"/api/items/{item_id}",
            json={"label": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_item_not_found(self, client, auth_headers):
        """Deleting a non-existent item returns 404."""
        response = client.delete("/api/items/99999", headers=auth_headers)
        assert response.status_code == 404
