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

    def test_import_uses_budget_sheet_even_when_not_active(self, client, auth_headers):
        """Import parses the BUDGET sheet even when DIAGRAMME is the active tab.

        Regression test: the parser previously relied on `wb.active`, which
        openpyxl resolves from the file's activeTab index. If a monthly budget
        file is saved with the "DIAGRAMME" tab selected (a small chart sheet
        with only Category/Subcategory/Cost columns), the import silently
        produced 0 income entries, 0 categories, and 0 expense items.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "DIAGRAMME"
        ws.append(["Category", "Subcategory", "Cost"])
        ws.append(["Wohnen", "Miete", 595])

        # BUDGET sheet holds the real parseable data
        budget_ws = wb.create_sheet("BUDGET")
        budget_ws["B2"] = "OKTOBER 2025 BUDGET"
        budget_ws["C4"] = "Einkommen"
        budget_ws["E4"] = 2837.01
        budget_ws["C8"] = "Einkommen"
        budget_ws["E8"] = 2837.01
        budget_ws["B12"] = "WOHNEN"
        budget_ws["C12"] = "Geschätzte Kosten"
        budget_ws["D12"] = "Tatsächl. Kosten"
        budget_ws["B13"] = "Miete"
        budget_ws["C13"] = 595
        budget_ws["D13"] = 595

        # Make DIAGRAMME the active tab (as in the real Oktober 2025 file)
        wb.active = 0

        buf = BytesIO()
        wb.save(buf)

        response = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "oktober.xlsx",
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["budget_title"] == "OKTOBER 2025 BUDGET"
        assert data["income_imported"] == 1
        assert data["categories_imported"] == 1
        assert data["items_imported"] == 1

    def _import_excel(self, client, auth_headers, excel_bytes, filename="budget.xlsx"):
        return client.post(
            "/api/budgets/import",
            files={
                "file": (
                    filename,
                    excel_bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )

    def test_import_duplicate_rejected(self, client, auth_headers):
        """Importing the same Excel file twice returns 409 conflict."""
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500), ("Extra", 300, 450)],
            categories=[
                ("Wohnen", [("Miete", 900, 900), ("Strom", 80, 75)]),
                ("Transport", [("Benzin", 150, 165)]),
            ],
        )

        # First import succeeds
        first = self._import_excel(client, auth_headers, excel_bytes)
        assert first.status_code == 201

        # Second identical import is refused as a duplicate
        second = self._import_excel(client, auth_headers, excel_bytes)
        assert second.status_code == 409

    def test_import_different_data_not_duplicate(self, client, auth_headers):
        """A file with different amounts is NOT treated as a duplicate."""
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500)],
            categories=[("Wohnen", [("Miete", 900, 900)])],
        )
        assert self._import_excel(client, auth_headers, excel_bytes).status_code == 201

        different = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2600)],  # actual amount differs
            categories=[("Wohnen", [("Miete", 900, 850)])],
        )
        resp = self._import_excel(client, auth_headers, different)
        assert resp.status_code == 201

    def test_import_duplicate_across_users_allowed(self, client, auth_headers, second_auth_headers):
        """The same file can be imported by two different users."""
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500)],
            categories=[("Wohnen", [("Miete", 900, 900)])],
        )
        assert self._import_excel(client, auth_headers, excel_bytes).status_code == 201
        # A different user can import the same data
        assert self._import_excel(client, second_auth_headers, excel_bytes).status_code == 201
