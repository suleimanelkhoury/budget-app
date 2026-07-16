"""Tests for the budget templates endpoints (CRUD + create-budget-from-template)."""

from decimal import Decimal


class TestTemplateCreate:
    """Tests for POST /api/templates/."""

    def test_create_template_with_categories_and_items(
        self, client, auth_headers
    ):
        """Creating a template with nested categories and items works."""
        response = client.post(
            "/api/templates/",
            json={
                "name": "Standard Month",
                "categories": [
                    {
                        "name": "Wohnen",
                        "sort_order": 0,
                        "items": [{"label": "Miete"}, {"label": "Strom"}],
                    },
                    {
                        "name": "Essen",
                        "sort_order": 1,
                        "items": [{"label": "Lebensmittel"}],
                    },
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Standard Month"
        assert len(data["categories"]) == 2
        assert data["categories"][0]["name"] == "Wohnen"
        assert len(data["categories"][0]["items"]) == 2
        assert data["categories"][0]["items"][0]["label"] == "Miete"
        assert data["categories"][1]["name"] == "Essen"
        assert len(data["categories"][1]["items"]) == 1

    def test_create_template_empty(self, client, auth_headers):
        """Creating a template with no categories works."""
        response = client.post(
            "/api/templates/",
            json={"name": "Empty Template", "categories": []},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["categories"] == []

    def test_create_template_unauthorized(self, client):
        """Creating a template without auth returns 401."""
        response = client.post(
            "/api/templates/",
            json={"name": "Test", "categories": []},
        )
        assert response.status_code == 401

    def test_create_template_missing_name(self, client, auth_headers):
        """A template must have a name."""
        response = client.post(
            "/api/templates/",
            json={"categories": []},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestTemplateList:
    """Tests for GET /api/templates/."""

    def test_list_templates_empty(self, client, auth_headers):
        """A user with no templates gets an empty list."""
        response = client.get("/api/templates/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_templates_only_own(
        self, client, auth_headers, second_auth_headers
    ):
        """A user only sees their own templates."""
        client.post(
            "/api/templates/",
            json={"name": "User 1 Template", "categories": []},
            headers=auth_headers,
        )
        client.post(
            "/api/templates/",
            json={"name": "User 2 Template", "categories": []},
            headers=second_auth_headers,
        )

        response = client.get("/api/templates/", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        assert len(templates) == 1
        assert templates[0]["name"] == "User 1 Template"


class TestTemplateGet:
    """Tests for GET /api/templates/{id}."""

    def test_get_template_success(self, client, auth_headers):
        """Getting a template returns its categories and items."""
        r = client.post(
            "/api/templates/",
            json={
                "name": "Standard",
                "categories": [
                    {"name": "Wohnen", "items": [{"label": "Miete"}]},
                ],
            },
            headers=auth_headers,
        )
        template_id = r.json()["id"]

        response = client.get(
            f"/api/templates/{template_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Standard"

    def test_get_template_not_found(self, client, auth_headers):
        """Getting a non-existent template returns 404."""
        response = client.get("/api/templates/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_template_forbidden(
        self, client, auth_headers, second_auth_headers
    ):
        """Getting another user's template returns 403."""
        r = client.post(
            "/api/templates/",
            json={"name": "Private", "categories": []},
            headers=auth_headers,
        )
        template_id = r.json()["id"]

        response = client.get(
            f"/api/templates/{template_id}", headers=second_auth_headers
        )
        assert response.status_code == 403


class TestTemplateDelete:
    """Tests for DELETE /api/templates/{id}."""

    def test_delete_template_success(self, client, auth_headers):
        """Deleting a template works."""
        r = client.post(
            "/api/templates/",
            json={"name": "To Delete", "categories": []},
            headers=auth_headers,
        )
        template_id = r.json()["id"]

        response = client.delete(
            f"/api/templates/{template_id}", headers=auth_headers
        )
        assert response.status_code == 204

        # Verify it's gone
        response = client.get(
            f"/api/templates/{template_id}", headers=auth_headers
        )
        assert response.status_code == 404

    def test_delete_template_forbidden(
        self, client, auth_headers, second_auth_headers
    ):
        """Deleting another user's template returns 403."""
        r = client.post(
            "/api/templates/",
            json={"name": "Mine", "categories": []},
            headers=auth_headers,
        )
        template_id = r.json()["id"]

        response = client.delete(
            f"/api/templates/{template_id}", headers=second_auth_headers
        )
        assert response.status_code == 403


class TestCreateBudgetFromTemplate:
    """Tests for POST /api/templates/{id}/create-budget."""

    def test_create_budget_from_template(
        self, client, auth_headers
    ):
        """Creating a budget from a template copies categories and items with zeroed amounts."""
        r = client.post(
            "/api/templates/",
            json={
                "name": "Standard Month",
                "categories": [
                    {
                        "name": "Wohnen",
                        "sort_order": 0,
                        "items": [{"label": "Miete"}, {"label": "Strom"}],
                    },
                ],
            },
            headers=auth_headers,
        )
        template_id = r.json()["id"]

        response = client.post(
            f"/api/templates/{template_id}/create-budget",
            json={"title": "Juli 2026", "month": 7, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 201
        budget = response.json()
        assert budget["title"] == "Juli 2026"
        assert budget["month"] == 7
        assert budget["year"] == 2026

        # Fetch the budget detail and verify structure was copied
        detail = client.get(
            f"/api/budgets/{budget['id']}", headers=auth_headers
        ).json()
        assert len(detail["categories"]) == 1
        assert detail["categories"][0]["name"] == "Wohnen"
        assert len(detail["categories"][0]["items"]) == 2
        # Amounts should be zeroed
        for item in detail["categories"][0]["items"]:
            assert Decimal(item["projected_cost"]) == Decimal("0")
            assert Decimal(item["actual_cost"]) == Decimal("0")
        # No income copied (templates don't include income)
        assert detail["incomes"] == []

    def test_create_budget_from_template_not_found(self, client, auth_headers):
        """Creating a budget from a non-existent template returns 404."""
        response = client.post(
            "/api/templates/99999/create-budget",
            json={"title": "Test", "month": 7, "year": 2026},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_create_budget_from_template_forbidden(
        self, client, auth_headers, second_auth_headers
    ):
        """Creating a budget from another user's template returns 403."""
        r = client.post(
            "/api/templates/",
            json={"name": "Private", "categories": []},
            headers=auth_headers,
        )
        template_id = r.json()["id"]

        response = client.post(
            f"/api/templates/{template_id}/create-budget",
            json={"title": "Stolen", "month": 7, "year": 2026},
            headers=second_auth_headers,
        )
        assert response.status_code == 403
