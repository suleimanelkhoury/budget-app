"""Tests for Excel import upload limits (size, zip bombs, dimensions)."""

import zipfile
from io import BytesIO

from openpyxl import Workbook

from app.core.config import settings
from tests.test_excel_import import _make_excel

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _import(client, auth_headers, excel_bytes, filename="budget.xlsx"):
    return client.post(
        "/api/budgets/import",
        files={"file": (filename, excel_bytes, XLSX_MIME)},
        headers=auth_headers,
    )


class TestUploadSizeLimit:
    """Uploads larger than MAX_UPLOAD_BYTES are rejected with 400."""

    def test_oversized_file_rejected(self, client, auth_headers, monkeypatch):
        # Valid workbook, but shrink the limit below its size
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500)],
            categories=[("Wohnen", [("Miete", 900, 900)])],
        )
        monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 1024)

        response = _import(client, auth_headers, excel_bytes)
        assert response.status_code == 400
        assert "too large" in response.json()["error"]["message"].lower()


class TestFileTypeRestriction:
    """Only .xlsx is accepted — the legacy .xls format is not readable."""

    def test_xls_extension_rejected(self, client, auth_headers):
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500)],
            categories=[("Wohnen", [("Miete", 900, 900)])],
        )
        response = _import(client, auth_headers, excel_bytes, filename="budget.xls")
        assert response.status_code == 400


class TestZipBombGuard:
    """Files whose decompressed content exceeds the limit are rejected."""

    def _bomb(self, uncompressed_size: int) -> bytes:
        """Build a tiny .xlsx-like zip that decompresses to a huge size.

        Highly compressible data (zeros) keeps the compressed file small
        while the uncompressed content exceeds the configured limit.
        """
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("xl/worksheets/sheet1.xml", b"0" * uncompressed_size)
        return buf.getvalue()

    def test_oversized_decompressed_content_rejected(
        self, client, auth_headers, monkeypatch
    ):
        monkeypatch.setattr(settings, "MAX_UNCOMPRESSED_BYTES", 1024 * 1024)
        bomb = self._bomb(uncompressed_size=10 * 1024 * 1024)
        assert len(bomb) < 100 * 1024  # compressed file is tiny

        response = _import(client, auth_headers, bomb)
        assert response.status_code == 400

    def test_too_many_zip_entries_rejected(self, client, auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "MAX_ZIP_ENTRIES", 3)
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for i in range(10):
                zf.writestr(f"entry{i}.txt", b"x")
        response = _import(client, auth_headers, buf.getvalue())
        assert response.status_code == 400

    def test_not_a_zip_rejected(self, client, auth_headers):
        # Text with an .xlsx extension is not a zip archive
        response = _import(client, auth_headers, b"this is not a zip file")
        assert response.status_code == 400


class TestSheetDimensionLimits:
    """Sheets with more rows/columns than allowed are rejected."""

    def test_too_many_rows_rejected(self, client, auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "MAX_EXCEL_ROWS", 5)

        wb = Workbook()
        ws = wb.active
        ws.title = "Many Rows"
        ws.append(["Label", "SOLL", "IST"])
        ws.append(["Einkommen", 2500, 2500])
        ws.append(["Wohnen", "", ""])
        for i in range(10):  # pushes max_row well past the limit
            ws.append([f"Item {i}", 10, 10])
        buf = BytesIO()
        wb.save(buf)

        response = _import(client, auth_headers, buf.getvalue())
        assert response.status_code == 400
        assert "too many rows" in response.json()["error"]["message"].lower()

    def test_too_many_columns_rejected(self, client, auth_headers, monkeypatch):
        monkeypatch.setattr(settings, "MAX_EXCEL_COLUMNS", 3)

        wb = Workbook()
        ws = wb.active
        ws.title = "Many Columns"
        ws.append(["Label", "SOLL", "IST", "Extra1", "Extra2", "Extra3"])
        ws.append(["Einkommen", 2500, 2500, 1, 2, 3])
        buf = BytesIO()
        wb.save(buf)

        response = _import(client, auth_headers, buf.getvalue())
        assert response.status_code == 400
        assert "too many columns" in response.json()["error"]["message"].lower()


class TestLimitsDontBreakValidImports:
    """The defaults are generous enough for real budget files."""

    def test_normal_import_still_works(self, client, auth_headers):
        excel_bytes = _make_excel(
            title="Juli 2026",
            incomes=[("Einkommen", 2500, 2500)],
            categories=[("Wohnen", [("Miete", 900, 900)])],
        )
        response = _import(client, auth_headers, excel_bytes)
        assert response.status_code == 201

    def test_workbook_with_many_rows_under_default_limit(
        self, client, auth_headers
    ):
        """A workbook with a few hundred rows imports fine (no false positive)."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Big Sheet"
        ws.append(["Label", "SOLL", "IST"])
        ws.append(["Einkommen", 2500, 2500])
        ws.append(["WOHNEN", "", ""])
        for i in range(200):
            ws.append([f"Posten {i}", 10, 10])
        buf = BytesIO()
        wb.save(buf)

        response = _import(client, auth_headers, buf.getvalue())
        assert response.status_code == 201
        assert response.json()["items_imported"] == 200
