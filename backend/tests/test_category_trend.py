"""Tests for the category trend endpoint (GET /api/budgets/category-trend)."""


class TestCategoryTrend:
    """GET /api/budgets/category-trend — per-month SOLL/IST for a category."""

    def _create_budget_with_category(
        self,
        client,
        auth_headers,
        title: str,
        month: int,
        year: int,
        items: list[tuple[str, str, str]],
        category_name: str = "Wohnen",
    ) -> int:
        """Create a budget with one category and return the budget id."""
        budget = client.post(
            "/api/budgets/",
            json={"title": title, "month": month, "year": year},
            headers=auth_headers,
        ).json()
        category = client.post(
            f"/api/budgets/{budget['id']}/categories",
            json={"name": category_name, "sort_order": 0},
            headers=auth_headers,
        ).json()
        for label, soll, ist in items:
            client.post(
                f"/api/categories/{category['id']}/items",
                json={"label": label, "projected_cost": soll, "actual_cost": ist},
                headers=auth_headers,
            )
        return budget["id"]

    def test_trend_sums_across_months(self, client, auth_headers):
        """The trend sums the category's items per month, oldest first."""
        self._create_budget_with_category(
            client, auth_headers, "Jan 2026", 1, 2026,
            [("Miete", "900", "850")],
        )
        self._create_budget_with_category(
            client, auth_headers, "Feb 2026", 2, 2026,
            [("Miete", "900", "900"), ("Strom", "80", "75")],
        )
        # March has a different category — must contribute zeros
        self._create_budget_with_category(
            client, auth_headers, "Mär 2026", 3, 2026,
            [("Benzin", "150", "160")],
            category_name="Transport",
        )

        response = client.get(
            "/api/budgets/category-trend",
            params={"category": "Wohnen"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category_name"] == "Wohnen"
        assert len(data["months"]) == 3

        jan, feb, mar = data["months"]
        assert jan["projected"] == "900.00" and jan["actual"] == "850.00"
        assert feb["projected"] == "980.00" and feb["actual"] == "975.00"
        # Missing category → zeros, month still present (no gap in the trend)
        assert mar["projected"] == "0" and mar["actual"] == "0"
        assert mar["month"] == 3 and mar["year"] == 2026

    def test_trend_case_insensitive_match(self, client, auth_headers):
        """Category matching ignores case and surrounding whitespace."""
        self._create_budget_with_category(
            client, auth_headers, "Jan 2026", 1, 2026,
            [("Miete", "900", "900")],
            category_name="Wohnen",
        )
        response = client.get(
            "/api/budgets/category-trend",
            params={"category": "  wohnen "},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["months"][0]["actual"] == "900.00"

    def test_trend_limits_to_recent_months(self, client, auth_headers):
        """`months` caps how far back the trend goes (most recent kept)."""
        for month in range(1, 6):  # Jan-May 2026
            self._create_budget_with_category(
                client, auth_headers, f"2026-{month:02d}", month, 2026,
                [("Miete", "900", "900")],
            )
        response = client.get(
            "/api/budgets/category-trend",
            params={"category": "Wohnen", "months": 3},
            headers=auth_headers,
        )
        data = response.json()
        assert len(data["months"]) == 3
        assert [m["month"] for m in data["months"]] == [3, 4, 5]

    def test_trend_months_param_validated(self, client, auth_headers):
        """Out-of-range `months` returns 422."""
        response = client.get(
            "/api/budgets/category-trend",
            params={"category": "Wohnen", "months": 0},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_trend_requires_auth(self, client):
        response = client.get(
            "/api/budgets/category-trend", params={"category": "Wohnen"}
        )
        assert response.status_code == 401

    def test_trend_isolated_per_user(self, client, auth_headers, second_auth_headers):
        """Another user's budgets don't appear in the trend."""
        self._create_budget_with_category(
            client, second_auth_headers, "Feb 2026", 2, 2026,
            [("Miete", "999", "999")],
        )
        self._create_budget_with_category(
            client, auth_headers, "Jan 2026", 1, 2026,
            [("Miete", "900", "900")],
        )
        response = client.get(
            "/api/budgets/category-trend",
            params={"category": "Wohnen"},
            headers=auth_headers,
        )
        months = response.json()["months"]
        assert len(months) == 1
        assert months[0]["actual"] == "900.00"
