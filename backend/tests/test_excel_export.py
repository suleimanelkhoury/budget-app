"""Tests for the Excel export endpoint — GET /api/budgets/{id}/export.

The exported file must be in the same template format the import parser
understands, so an exported budget can be re-imported losslessly.
"""

from io import BytesIO

from openpyxl import load_workbook

from app.services.excel_export import build_budget_excel


def _create_budget_with_data(client, auth_headers):
    """Create a budget with income, categories, and items via the API.

    Returns the budget_id.
    """
    resp = client.post(
        "/api/budgets/",
        json={"title": "Juli 2026", "month": 7, "year": 2026},
        headers=auth_headers,
    )
    bid = resp.json()["id"]

    client.post(
        f"/api/budgets/{bid}/income",
        json={
            "label": "Einkommen",
            "projected_amount": "2500",
            "actual_amount": "2600",
        },
        headers=auth_headers,
    )
    client.post(
        f"/api/budgets/{bid}/income",
        json={
            "label": "Extra",
            "projected_amount": "300",
            "actual_amount": "450",
        },
        headers=auth_headers,
    )

    r = client.post(
        f"/api/budgets/{bid}/categories",
        json={"name": "Wohnen", "sort_order": 0},
        headers=auth_headers,
    )
    cat1 = r.json()["id"]
    r = client.post(
        f"/api/budgets/{bid}/categories",
        json={"name": "Transport", "sort_order": 1},
        headers=auth_headers,
    )
    cat2 = r.json()["id"]

    client.post(
        f"/api/categories/{cat1}/items",
        json={"label": "Miete", "projected_cost": "900", "actual_cost": "850"},
        headers=auth_headers,
    )
    client.post(
        f"/api/categories/{cat1}/items",
        json={"label": "Strom", "projected_cost": "80", "actual_cost": "75"},
        headers=auth_headers,
    )
    client.post(
        f"/api/categories/{cat2}/items",
        json={"label": "Benzin", "projected_cost": "150", "actual_cost": "165"},
        headers=auth_headers,
    )

    return bid


class TestExcelExport:
    """Tests for GET /api/budgets/{id}/export."""

    def test_export_returns_xlsx(self, client, auth_headers):
        """Export returns a downloadable .xlsx with the right content type."""
        bid = _create_budget_with_data(client, auth_headers)

        response = client.get(f"/api/budgets/{bid}/export", headers=auth_headers)

        assert response.status_code == 200
        assert (
            response.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert "attachment" in response.headers.get("content-disposition", "").lower()
        # Bytes must be a valid .xlsx (zip) file
        assert response.content[:2] == b"PK"

        wb = load_workbook(BytesIO(response.content))
        assert "BUDGET" in wb.sheetnames

    def test_export_roundtrip_reimport(self, client, auth_headers, second_auth_headers):
        """Exporting a budget then re-importing it preserves all data.

        The exported file reproduces the source budget's data (as a fresh
        budget titled "<Month> <Year> BUDGET"). Importing the export as a
        *different* user proves the file round-trips without tripping the
        per-user duplicate detector.
        """
        bid = _create_budget_with_data(client, auth_headers)

        exported = client.get(f"/api/budgets/{bid}/export", headers=auth_headers)
        assert exported.status_code == 200

        # Re-import the exported file as a second user — the duplicate
        # detector is scoped per-user, so this must succeed.
        reimport = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "exported.xlsx",
                    exported.content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=second_auth_headers,
        )
        assert reimport.status_code == 201
        new_bid = reimport.json()["budget_id"]

        imported = client.get(
            f"/api/budgets/{new_bid}", headers=second_auth_headers
        ).json()

        # The exported file re-imports with the same content as the source
        # (the exported title is UPPERCASED like the template's B2 cell)
        assert imported["title"] == "JULI 2026 BUDGET"
        assert imported["month"] == 7
        assert imported["year"] == 2026

        # Income preserved (labels + amounts)
        assert len(imported["incomes"]) == 2
        income_by_label = {i["label"]: i for i in imported["incomes"]}
        assert income_by_label["Einkommen"]["projected_amount"] == "2500.00"
        assert income_by_label["Einkommen"]["actual_amount"] == "2600.00"
        assert income_by_label["Extra"]["projected_amount"] == "300.00"
        assert income_by_label["Extra"]["actual_amount"] == "450.00"

        # Categories preserved (names + items + amounts)
        assert len(imported["categories"]) == 2
        cats_by_name = {c["name"]: c for c in imported["categories"]}
        assert set(cats_by_name) == {"Wohnen", "Transport"}

        wohnen_items = {i["label"]: i for i in cats_by_name["Wohnen"]["items"]}
        assert len(wohnen_items) == 2
        assert wohnen_items["Miete"]["projected_cost"] == "900.00"
        assert wohnen_items["Miete"]["actual_cost"] == "850.00"
        assert wohnen_items["Strom"]["projected_cost"] == "80.00"
        assert wohnen_items["Strom"]["actual_cost"] == "75.00"

        transport_items = {i["label"]: i for i in cats_by_name["Transport"]["items"]}
        assert len(transport_items) == 1
        assert transport_items["Benzin"]["projected_cost"] == "150.00"
        assert transport_items["Benzin"]["actual_cost"] == "165.00"

    def test_export_duplicate_reimport_rejected(self, client, auth_headers):
        """Re-importing an export while the original exists returns 409.

        This is the strongest round-trip signal: when the source budget was
        itself created from an export (so its title already matches the
        "<Month> <Year> BUDGET" template), the re-export reproduces it so
        faithfully that the duplicate detector flags the re-import.
        """
        # Create the source budget by importing a constructed file with the
        # same title the export would produce, so fingerprints line up.
        from io import BytesIO

        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "Juli 2026 BUDGET"
        ws.append(["Label", "SOLL", "IST"])
        ws.append(["Einkommen", 2500, 2600])
        ws.append(["Wohnen", "", ""])
        ws.append(["Miete", 900, 850])

        buf = BytesIO()
        wb.save(buf)

        # Import the template-style file first
        import_resp = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "source.xlsx",
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert import_resp.status_code == 201
        bid = import_resp.json()["budget_id"]

        # Export it and re-import the export as the SAME user → duplicate 409.
        exported = client.get(f"/api/budgets/{bid}/export", headers=auth_headers)
        assert exported.status_code == 200

        reimport = client.post(
            "/api/budgets/import",
            files={
                "file": (
                    "exported.xlsx",
                    exported.content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=auth_headers,
        )
        assert reimport.status_code == 409

    def test_export_unauthorized(self, client):
        """Exporting without auth returns 401."""
        response = client.get("/api/budgets/1/export")
        assert response.status_code == 401

    def test_export_nonexistent(self, client, auth_headers):
        """Exporting a budget that doesn't exist returns 404."""
        response = client.get("/api/budgets/99999/export", headers=auth_headers)
        assert response.status_code == 404

    def test_export_other_users_budget(self, client, auth_headers, second_auth_headers):
        """A user cannot export another user's budget."""
        bid = _create_budget_with_data(client, auth_headers)
        response = client.get(
            f"/api/budgets/{bid}/export", headers=second_auth_headers
        )
        assert response.status_code == 403


class TestBuildBudgetExcel:
    """Unit tests for the excel building service (no HTTP)."""

    def test_excel_has_expected_structure(self, client, auth_headers, db_session):
        """The built worksheet has the template structure (B2 title, blocks)."""
        bid = _create_budget_with_data(client, auth_headers)

        # Build an in-memory Budget model instance against the test DB so the
        # service can load its relationships via selectinload.
        from app.models.budget import Budget

        budget = db_session.get(Budget, bid)
        xlsx = build_budget_excel(budget, db_session)

        wb = load_workbook(BytesIO(xlsx))
        ws = wb["BUDGET"]

        # Title in B2 (UPPERCASE month like the template)
        assert ws["B2"].value == "JULI 2026 BUDGET"

        # Income section headers
        assert ws["B4"].value == "SOLL MONATLICHES EINKOMMEN"
        assert ws["B8"].value == "IST MONATLICHES EINKOMMEN"

        # Income labels in column C with values in column E
        col_c = [ws.cell(row=r, column=3).value for r in range(1, ws.max_row + 1)]
        assert "Einkommen" in col_c
        assert "Extra" in col_c

        # Balance labels present (right block, column G)
        col_g = [ws.cell(row=r, column=7).value for r in range(1, ws.max_row + 1)]
        balance_texts = " ".join(str(v) for v in col_g if v)
        assert "SOLL BALANCE" in balance_texts
        assert "IST BALANCE" in balance_texts
        assert "UNTERSCHIED" in balance_texts

        # Category headers present in UPPERCASE form
        col_b = [ws.cell(row=r, column=2).value for r in range(1, ws.max_row + 1)]
        headerless_b = [v for v in col_b if v and v != "Zwischensumme"]
        # Categories are distributed across the two blocks; both headers must
        # appear somewhere.
        assert ("WOHNEN" in headerless_b) or ("WOHNEN" in col_g)
        assert ("TRANSPORT" in headerless_b) or ("TRANSPORT" in col_g)

        # Item labels present (preserve their original case)
        item_labels = [
            v
            for v in col_b + col_g
            if v
            and v not in ("Zwischensumme", "WOHNEN", "TRANSPORT")
            and not str(v).startswith(("SOLL ", "IST ", "GESAMT", "UNTERSCHIED"))
        ]
        assert "Miete" in item_labels
        assert "Strom" in item_labels
        assert "Benzin" in item_labels

        # "Zwischensumme" subtotal rows exist
        assert any(v == "Zwischensumme" for v in col_b + col_g if v)

        # Totals section present
        totals_texts = " ".join(str(v) for v in col_g if v)
        assert "SOLL GESAMTKOSTEN" in totals_texts
        assert "IST GESAMTKOSTEN" in totals_texts
        assert "GESAMTUNTERSCHIED" in totals_texts

    def test_excel_per_row_and_subtotal_difference(self, client, auth_headers, db_session):
        """Every item row has its own Unterschied formula; Zwischensumme too."""
        bid = _create_budget_with_data(client, auth_headers)
        from app.models.budget import Budget

        budget = db_session.get(Budget, bid)
        xlsx = build_budget_excel(budget, db_session)

        wb = load_workbook(BytesIO(xlsx))
        ws = wb["BUDGET"]

        # Wohnen (left block, columns B/C/D/E) starts at row 12
        # Miete at row 13, Strom at 14, Zwischensumme at 15
        assert ws["B13"].value == "Miete"
        assert ws["C13"].value == 900
        assert ws["D13"].value == 850
        assert ws["E13"].value == "=C13-D13"          # per-row difference
        assert ws["E14"].value == "=C14-D14"          # per-row difference

        # Zwischensumme subtotal with SUM formulas + difference
        assert ws["B15"].value == "Zwischensumme"
        assert ws["C15"].value == "=SUM(C13:C14)"
        assert ws["D15"].value == "=SUM(D13:D14)"
        assert ws["E15"].value == "=C15-D15"

    def test_excel_income_balance_and_totals_formulas(
        self, client, auth_headers, db_session
    ):
        """The balance + totals rows reference each other like the template."""
        bid = _create_budget_with_data(client, auth_headers)
        from app.models.budget import Budget

        budget = db_session.get(Budget, bid)
        xlsx = build_budget_excel(budget, db_session)

        wb = load_workbook(BytesIO(xlsx))
        ws = wb["BUDGET"]

        # Income values: SOLL at E4/E5, IST at E9/E10 (one row lower than the
        # template so the importer's SOLL read window doesn't collide).
        assert ws["E4"].value == 2500.0
        assert ws["E5"].value == 300.0
        assert ws["E9"].value == 2600.0
        assert ws["E10"].value == 450.0

        # Totals row: the taller category block ends the categories; the
        # totals are the G/J rows directly below. With Wohnen (left: Miete,
        # Strom -> rows 12-15) and Transport (right: Benzin -> rows 12-14)
        # the left block is taller -> last_cat_row = 15, totals at 16/18/20.
        assert ws["G16"].value == "SOLL GESAMTKOSTEN"
        assert ws["G18"].value == "IST GESAMTKOSTEN"
        assert ws["G20"].value == "GESAMTUNTERSCHIED"
        print("J16:", ws["J16"].value)
        print("J18:", ws["J18"].value)
        print("J20:", ws["J20"].value)
        assert str(ws["J16"].value) == "=SUM(C12:C15,H12:H15)"
        assert str(ws["J18"].value) == "=SUM(D12:D15,I12:I15)"
        assert str(ws["J20"].value) == "=J16-J18"
