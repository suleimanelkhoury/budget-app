"""Tests for budget CRUD endpoints."""


class TestBudgetCreate:
    """Tests for POST /api/budgets/."""

    def test_create_budget_success(self, client, auth_headers):
        """A logged-in user can create a budget."""
        response = client.post(
            "/api/budgets/",
            json={"title": "Juli 2026", "month": 7, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Juli 2026"
        assert data["month"] == 7
        assert data["year"] == 2026
        assert "id" in data
        assert "created_at" in data

    def test_create_budget_unauthorized(self, client):
        """Creating a budget without auth returns 401."""
        response = client.post(
            "/api/budgets/",
            json={"title": "Test", "month": 1, "year": 2026},
        )
        assert response.status_code == 401

    def test_create_budget_invalid_month(self, client, auth_headers):
        """Month must be between 1 and 12."""
        response = client.post(
            "/api/budgets/",
            json={"title": "Test", "month": 13, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_create_budget_missing_title(self, client, auth_headers):
        """Title is required."""
        response = client.post(
            "/api/budgets/",
            json={"month": 7, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestBudgetList:
    """Tests for GET /api/budgets/."""

    def test_list_budgets_empty(self, client, auth_headers):
        """A user with no budgets gets an empty list."""
        response = client.get("/api/budgets/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_budgets_returns_only_own(
        self, client, auth_headers, second_auth_headers
    ):
        """A user only sees their own budgets, not other users'."""
        # User 1 creates a budget
        client.post(
            "/api/budgets/",
            json={"title": "User 1 Budget", "month": 7, "year": 2026},
            headers=auth_headers,
        )
        # User 2 creates a budget
        client.post(
            "/api/budgets/",
            json={"title": "User 2 Budget", "month": 8, "year": 2026},
            headers=second_auth_headers,
        )

        # User 1 sees only their budget
        response = client.get("/api/budgets/", headers=auth_headers)
        assert response.status_code == 200
        budgets = response.json()
        assert len(budgets) == 1
        assert budgets[0]["title"] == "User 1 Budget"

    def test_list_budgets_unauthorized(self, client):
        """Listing budgets without auth returns 401."""
        response = client.get("/api/budgets/")
        assert response.status_code == 401


class TestBudgetGet:
    """Tests for GET /api/budgets/{id}."""

    def test_get_budget_with_details(self, client, auth_headers, budget_with_data):
        """Getting a budget returns nested categories, items, and income."""
        bid = budget_with_data["budget_id"]
        response = client.get(f"/api/budgets/{bid}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == bid
        assert len(data["incomes"]) == 1
        assert data["incomes"][0]["label"] == "Einkommen"
        assert len(data["categories"]) == 1
        assert data["categories"][0]["name"] == "Wohnen"
        assert len(data["categories"][0]["items"]) == 1
        assert data["categories"][0]["items"][0]["label"] == "Miete"

    def test_get_budget_not_found(self, client, auth_headers):
        """Getting a non-existent budget returns 404."""
        response = client.get("/api/budgets/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_budget_forbidden(
        self, client, auth_headers, second_auth_headers, budget
    ):
        """A user cannot get another user's budget (403)."""
        response = client.get(
            f"/api/budgets/{budget['id']}", headers=second_auth_headers
        )
        assert response.status_code == 403


class TestBudgetUpdate:
    """Tests for PUT /api/budgets/{id}."""

    def test_update_budget_title(self, client, auth_headers, budget):
        """Updating the title works."""
        response = client.put(
            f"/api/budgets/{budget['id']}",
            json={"title": "Updated Title"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"
        # Other fields unchanged
        assert response.json()["month"] == budget["month"]

    def test_update_budget_partial(self, client, auth_headers, budget):
        """Partial updates only change provided fields."""
        response = client.put(
            f"/api/budgets/{budget['id']}",
            json={"month": 12},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["month"] == 12
        assert response.json()["title"] == budget["title"]

    def test_update_budget_not_found(self, client, auth_headers):
        """Updating a non-existent budget returns 404."""
        response = client.put(
            "/api/budgets/99999",
            json={"title": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_budget_forbidden(
        self, client, auth_headers, second_auth_headers, budget
    ):
        """A user cannot update another user's budget (403)."""
        response = client.put(
            f"/api/budgets/{budget['id']}",
            json={"title": "Hacked"},
            headers=second_auth_headers,
        )
        assert response.status_code == 403


class TestBudgetDelete:
    """Tests for DELETE /api/budgets/{id}."""

    def test_delete_budget_success(self, client, auth_headers, budget):
        """Deleting a budget returns 204."""
        response = client.delete(f"/api/budgets/{budget['id']}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        response = client.get(f"/api/budgets/{budget['id']}", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_budget_cascades(self, client, auth_headers, budget_with_data):
        """Deleting a budget removes its categories, items, and income."""
        bid = budget_with_data["budget_id"]
        cid = budget_with_data["category_id"]
        iid = budget_with_data["income_id"]

        # Delete the budget
        response = client.delete(f"/api/budgets/{bid}", headers=auth_headers)
        assert response.status_code == 204

        # Category should be gone (use PUT since there's no GET for individual categories)
        response = client.put(
            f"/api/categories/{cid}",
            json={"name": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

        # Income should be gone
        response = client.put(
            f"/api/income/{iid}",
            json={"label": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_budget_not_found(self, client, auth_headers):
        """Deleting a non-existent budget returns 404."""
        response = client.delete("/api/budgets/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_delete_budget_forbidden(
        self, client, auth_headers, second_auth_headers, budget
    ):
        """A user cannot delete another user's budget (403)."""
        response = client.delete(
            f"/api/budgets/{budget['id']}", headers=second_auth_headers
        )
        assert response.status_code == 403
