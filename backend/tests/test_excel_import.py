"""Tests for the Excel import endpoint — POST /api/budgets/import."""

from io import BytesIO

from openpyxl import Workbook


def _make_excel(
    title: str = "Juli 2026",
    incomes: list[tuple[str, int | float, int | float]] | None = None,
    categories: list[tuple[str, list[tuple[str, int | float, int | float]]]]
    | None = None,
) -> bytes:
    """Build an in-memory .xlsx file with the given structure.

    Args:
        title: Sheet name (used as budget title).
        incomes: List of (label, soll, ist) income rows.
        categories: List of (category_name, [(item_label, soll, ist), ...]).

    Returns:
        The .xlsx file as bytes.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = title

    # Header row
    ws.append(["Label", "SOLL", "IST"])

    for label, soll, ist in incomes or []:
        ws.append([label, soll, ist])

    for cat_name, items in categories or []:
        ws.append([cat_name, "", ""])
        for label, soll, ist in items:
            ws.append([label, soll, ist])

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


class TestExcelImport:
    """Tests for POST /api/budgets/import."""

    def test_import_success(self, client, auth_headers):
        """A valid Excel file creates a budget with categories, income, and items."""
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500), ("Extra", 300, 450)],
            categories=[
                ("Wohnen", [("Miete", 900, 900), ("Strom", 80, 75)]),
                ("Transport", [("Benzin", 150, 165)]),
            ],
        )

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "budget.xlsx",
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["budget_title"] == "Juli 2026"
        assert data["categories_imported"] == 2
        assert data["income_imported"] == 2
        assert data["items_imported"] == 3
        assert "budget_id" in data

    def test_import_parses_month_year_from_title(self, client, auth_headers):
        """The import detects month and year from the sheet title."""
        excel_bytes = _make_excel(
            title="August 2026",
            incomes=[("Einkommen", 2000, 2000)],
            categories=[("Wohnen", [("Miete", 800, 800)])],
        )

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "budget.xlsx",
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        bid = response.json()["budget_id"]

        # Verify the budget has month=8, year=2026
        budget_resp = client.get(f"/api/budgets/{bid}", headers=auth_headers)
        assert budget_resp.json()["month"] == 8
        assert budget_resp.json()["year"] == 2026

    def test_import_verify_data(self, client, auth_headers):
        """Imported data can be retrieved via the budget detail endpoint."""
        excel_bytes = _make_excel(
            title="Test Budget",
            incomes=[("Einkommen", 2500, 2600)],
            categories=[("Wohnen", [("Miete", 900, 850)])],
        )

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "budget.xlsx",
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        bid = response.json()["budget_id"]

        # Fetch the budget detail
        detail = client.get(f"/api/budgets/{bid}", headers=auth_headers).json()
        assert len(detail["incomes"]) == 1
        assert detail["incomes"][0]["label"] == "Einkommen"
        assert detail["incomes"][0]["projected_amount"] == "2500.00"
        assert detail["incomes"][0]["actual_amount"] == "2600.00"

        assert len(detail["categories"]) == 1
        assert detail["categories"][0]["name"] == "Wohnen"
        assert len(detail["categories"][0]["items"]) == 1
        assert detail["categories"][0]["items"][0]["label"] == "Miete"
        assert detail["categories"][0]["items"][0]["projected_cost"] == "900.00"
        assert detail["categories"][0]["items"][0]["actual_cost"] == "850.00"

    def test_import_summary_correct(self, client, auth_headers):
        """The summary of an imported budget calculates correctly."""
        excel_bytes = _make_excel(
            title="Summary Test",
            incomes=[("Einkommen", 2500, 2500)],
            categories=[("Wohnen", [("Miete", 900, 850), ("Strom", 80, 90)])],
        )

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "budget.xlsx",
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        bid = response.json()["budget_id"]

        summary = client.get(f"/api/budgets/{bid}/summary", headers=auth_headers).json()
        # Income: 2500 projected, 2500 actual
        assert summary["total_projected_income"] == "2500.00"
        # Expenses: 900 + 80 = 980 projected, 850 + 90 = 940 actual
        assert summary["total_projected_expenses"] == "980.00"
        assert summary["total_actual_expenses"] == "940.00"
        # Balance: 2500 - 980 = 1520 projected
        assert summary["projected_balance"] == "1520.00"

    def test_import_unauthorized(self, client):
        """Importing without auth returns 401."""
        excel_bytes = _make_excel()
        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "budget.xlsx",
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 401

    def test_import_wrong_file_type(self, client, auth_headers):
        """Uploading a non-Excel file returns 400."""
        response = client.post(
            "/api/budgets/import",
            files={"file": ("budget.txt", b"not an excel file", "text/plain")},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_import_empty_file(self, client, auth_headers):
        """Uploading an empty file returns 400."""
        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "empty.xlsx",
                    b"",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_import_no_valid_data(self, client, auth_headers):
        """An Excel file with no recognized categories or income returns 400."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Empty"
        ws.append(["Label", "SOLL", "IST"])
        ws.append(["Unknown Row", 100, 200])

        buf = BytesIO()
        wb.save(buf)

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "no_data.xlsx",
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_import_german_number_format(self, client, auth_headers):
        """The parser handles German number format (1.234,56)."""
        wb = Workbook()
        ws = wb.active
        ws.title = "German Numbers"
        ws.append(["Label", "SOLL", "IST"])
        ws.append(["Einkommen", "2.500,00", "2.600,50"])
        ws.append(["Wohnen", "", ""])
        ws.append(["Miete", "900,00", "850,50"])

        buf = BytesIO()
        wb.save(buf)

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "german.xlsx",
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        bid = response.json()["budget_id"]

        detail = client.get(f"/api/budgets/{bid}", headers=auth_headers).json()
        assert detail["incomes"][0]["projected_amount"] == "2500.00"
        assert detail["incomes"][0]["actual_amount"] == "2600.50"
        assert detail["categories"][0]["items"][0]["projected_cost"] == "900.00"
        assert detail["categories"][0]["items"][0]["actual_cost"] == "850.50"
