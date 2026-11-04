"""Excel export service — build .xlsx files matching the original budget template.

The generated workbook mirrors the personal monthly budget template
("Oktober 2026 Budget.xlsx") in *appearance*: same layout, fonts, colors,
Excel tables for each category, merged cells, and the DIAGRAMME chart sheet —
so an exported budget looks like the original and can be re-imported.

Template layout:

  - B2:        budget title, e.g. "OKTOBER 2026 BUDGET" (Century Gothic 22pt,
               medium bottom border)
  - Income:    "SOLL MONATLICHES EINKOMMEN" (B4:C4, merged B4:B6, label C),
               labels C4/C5, values E4/E5, "Monatliches Gsmt.einkommen" (C6,
               merged C6:D6) + SUM in E6 (gray fill)
               IST block: B8 (merged B8:B10), labels C9/C10, E9/E10, E11 SUM
  - Balance:   merged labels in G4:I5, G6:I7, G8:I9 with thin borders, values
               J4:J5, J6:J7, J8:J9 (gray fill, bold) referencing the totals
  - Categories: rows from 12, two side-by-side blocks as real Excel tables:
               Left:  label=B, SOLL=C, IST=D, diff=E
               Right: label=G, SOLL=H, IST=I, diff=J
               Each category is its own named table (Housing, Entertainment,
               Transportation, ...) with a header row (dark teal #24585C,
               white bold text), banded rows (light teal #DAEFF1), the
               "Zwischensumme" totals row (double top border), and teal
               borders (#91D0D4) — matching the original's "Personal monthly
               budget" table style.
  - Totals:    "SOLL GESAMTKOSTEN" / "IST GESAMTKOSTEN" /
               "GESAMTUNTERSCHIED" in merged G/I rows, J values (bold, gray
               fill) directly below the last category.
  - DIAGRAMME: a second sheet mirroring the original's chart sheet, linking
               the first few item rows' IST values per category.

Number format and colors match the template: Century Gothic font,
Euro number format, gray #D9D9D9 fill on totals/balance cells.
"""

from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.budget import Budget
from app.models.category import Category

# ── Fonts / colors matching the original template ──
CENTURY_GOTHIC = "Century Gothic"
FONT_TITLE = Font(name=CENTURY_GOTHIC, size=22)
FONT_SECTION = Font(name=CENTURY_GOTHIC, size=10, bold=True)
FONT_BODY = Font(name=CENTURY_GOTHIC, size=10)
FONT_BOLD = Font(name=CENTURY_GOTHIC, size=10, bold=True)
FONT_WHITE_BOLD = Font(name=CENTURY_GOTHIC, size=10, bold=True, color="FFFFFF")

# Table colors (from the original's "Personal monthly budget" style)
TEAL = "47B0B8"
TEAL_DARK = "24585C"    # header row fill (theme4 -0.5)
TEAL_LIGHT = "DAEFF1"   # banded stripe fill (theme4 +0.8)
TEAL_BORDER = "91D0D4"  # thin border (theme4 +0.4)

# Gray fill used on totals / balance cells (theme 0 white, -15% tint)
TOTAL_FILL = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")
HEADER_FILL = PatternFill(start_color=TEAL_DARK, end_color=TEAL_DARK, fill_type="solid")
BAND_FILL = PatternFill(start_color=TEAL_LIGHT, end_color=TEAL_LIGHT, fill_type="solid")

# Borders
THIN_TEAL = Side(style="thin", color=TEAL_BORDER)
TABLE_BORDER = Border(
    left=THIN_TEAL, right=THIN_TEAL, top=THIN_TEAL, bottom=THIN_TEAL
)
SIMPLE_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
TITLE_BORDER = Border(bottom=Side(style="medium"))
TOTAL_TOP_BORDER = Border(top=Side(style="double", color=TEAL))

# Euro number format (matches the template exactly)
EURO_NUMBER_FORMAT = (
    '_-[$€-2]\\ * #,##0.00_-;[RED]-[$€-2]\\ * #,##0.00_-;'
    '_-[$€-2]\\ * "-"??_-;_-@_-'
)

# Column width hints (template-ish)
COLUMN_WIDTHS = {
    "A": 2.71,   # instruction column (narrow like the original)
    "B": 19.57,  # left block labels / section headers
    "C": 16.0,   # left SOLL income labels / numbers
    "D": 13.0,   # left IST
    "E": 12.57,  # left Unterschied / income values
    "F": 2.71,   # spacer
    "G": 27.14,  # right block labels / balance labels
    "H": 16.0,   # right SOLL
    "I": 13.0,   # right IST
    "J": 12.57,  # right Unterschied / totals
    "K": 2.71,   # right spacer
}

GERMAN_MONTH_NAMES = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
]

# English table names used by the template for the category tables
TABLE_NAMES = [
    "Housing",
    "Transportation",
    "Insurance",
    "Food",
    "Pets",
    "PersonalCare",
    "Entertainment",
    "Loans",
    "Taxes",
    "Savings",
    "Gifts",
    "Legal",
]

# Column positions of the two side-by-side category blocks
# (label, SOLL, IST, diff).
LEFT_BLOCK: tuple[int, int, int, int] = (2, 3, 4, 5)    # B, C, D, E
RIGHT_BLOCK: tuple[int, int, int, int] = (7, 8, 9, 10)  # G, H, I, J

# Fixed rows from the template
SOLL_INCOME_HEADER_ROW = 4
IST_INCOME_HEADER_ROW = 8
CATEGORY_START_ROW = 12

# Income rows have stunted height in the template
INCOME_ROW_HEIGHT = 13.5
TITLE_ROW_HEIGHT = 29.25


def _euro(value: Decimal) -> float:
    """Convert a Decimal amount to a float for writing into a cell."""
    return float(value or Decimal("0"))


def _title_block_title(budget: Budget) -> str:
    """Build the title string placed in B2 (e.g. 'OKTOBER 2026 BUDGET')."""
    month_name = GERMAN_MONTH_NAMES[budget.month - 1]
    return f"{month_name.upper()} {budget.year} BUDGET"


def _write_number(
    ws: Worksheet, row: int, col: int, value: Decimal
) -> None:
    """Write a decimal amount as a number with the template Euro format."""
    cell = ws.cell(row=row, column=col, value=_euro(value))
    cell.number_format = EURO_NUMBER_FORMAT


def _write_formula(
    ws: Worksheet, row: int, col: int, formula: str
) -> None:
    """Write a formula cell with the template Euro format + gray fill."""
    cell = ws.cell(row=row, column=col, value=formula)
    cell.number_format = EURO_NUMBER_FORMAT
    cell.font = FONT_BOLD
    cell.fill = TOTAL_FILL


def _set_worksheet_widths(ws: Worksheet) -> None:
    """Apply the template's column widths to a worksheet."""
    for letter, width in COLUMN_WIDTHS.items():
        ws.column_dimensions[letter].width = width


def _category_groups(budget: Budget) -> list[tuple[Category, list]]:
    """Return (category, [items]) pairs in deterministic display order.

    Categories come back sorted by ``sort_order`` (then id); items in id order.
    Empty categories are included (with an empty list) so they are not lost.
    """
    cats = sorted(budget.categories or [], key=lambda c: (c.sort_order, c.id))
    return [(cat, list(cat.items)) for cat in cats]


def _set_row_height(ws: Worksheet, rows: range) -> None:
    """Apply the template's short row height to income rows."""
    for r in rows:
        ws.row_dimensions[r].height = INCOME_ROW_HEIGHT


def _merge_and_center(
    ws: Worksheet, cell_range: str, value: str, font, *, wrap: bool = True
) -> None:
    """Merge a range, write its top-left value, and style it."""
    ws.merge_cells(cell_range)
    top_left = cell_range.split(":")[0]
    cell = ws[top_left]
    cell.value = value
    cell.font = font
    cell.alignment = Alignment(
        horizontal="center", vertical="center", wrap_text=wrap
    )


def _style_balance_boxes(ws: Worksheet, rows: list[int]) -> None:
    """Add thin borders + center alignment to the balance label boxes."""
    for r in rows:
        for col in range(7, 11):  # G..J
            ws.cell(row=r, column=col).border = SIMPLE_BORDER
            ws.cell(row=r, column=col).alignment = Alignment(
                horizontal="center", vertical="center", wrap_text=True
            )


def _write_income_section(
    ws: Worksheet, budget: Budget, total_soll_row: int, total_ist_row: int
) -> None:
    """Write the income + balance section matching the template rows 4-10.

    ``total_soll_row`` / ``total_ist_row`` are the rows of the SOLL/IST
    GESAMTKOSTEN totals (computed by the caller from the category layout),
    referenced by the SOLL/IST BALANCE formulas.

    The IST income labels are placed one row lower than the template so the
    importer's SOLL income read window (5 rows from the first "Einkommen"
    label) never reaches the IST block.
    """
    incomes = list(budget.incomes or [])
    # Deduplicate by label, keeping first-seen order.
    ordered: list = []
    seen: set[str] = set()
    for inc in incomes:
        if inc.label not in seen:
            seen.add(inc.label)
            ordered.append(inc)
    # Ensure at least one row is labeled "Einkommen" so the importer's income
    # detection (anchored on the exact label) can find the section.
    if "Einkommen" not in seen and ordered:
        ordered.insert(0, ordered[0])
    # Only the first 2 rows fit the template layout.
    income_rows = ordered[:2]

    _set_row_height(ws, range(4, 12))

    # ── SOLL block ────────────────────────────
    _merge_and_center(
        ws,
        f"B{SOLL_INCOME_HEADER_ROW}:B{SOLL_INCOME_HEADER_ROW + 2}",
        "SOLL MONATLICHES EINKOMMEN",
        FONT_SECTION,
    )
    for i, inc in enumerate(income_rows):
        ws.cell(
            row=SOLL_INCOME_HEADER_ROW + i, column=3, value=inc.label
        ).font = FONT_BODY
        _write_number(ws, SOLL_INCOME_HEADER_ROW + i, 5, inc.projected_amount)
        # Merge the label across C:D like the template
        ws.merge_cells(
            f"C{SOLL_INCOME_HEADER_ROW + i}:D{SOLL_INCOME_HEADER_ROW + i}"
        )
        ws.cell(
            row=SOLL_INCOME_HEADER_ROW + i, column=3
        ).alignment = Alignment(horizontal="right")
    _merge_and_center(
        ws,
        f"C{SOLL_INCOME_HEADER_ROW + 2}:D{SOLL_INCOME_HEADER_ROW + 2}",
        "Monatliches Gsmt.einkommen",
        FONT_BOLD,
    )
    _write_formula(
        ws,
        SOLL_INCOME_HEADER_ROW + 2,
        5,
        f"=SUM(E{SOLL_INCOME_HEADER_ROW}:E{SOLL_INCOME_HEADER_ROW + 1})",
    )

    # ── IST block (labels one row lower than the template) ──
    ist_label_start = IST_INCOME_HEADER_ROW + 1
    _merge_and_center(
        ws,
        f"B{IST_INCOME_HEADER_ROW}:B{ist_label_start + 2}",
        "IST MONATLICHES EINKOMMEN",
        FONT_SECTION,
    )
    for i, inc in enumerate(income_rows):
        ws.cell(
            row=ist_label_start + i, column=3, value=inc.label
        ).font = FONT_BODY
        _write_number(ws, ist_label_start + i, 5, inc.actual_amount)
        ws.merge_cells(f"C{ist_label_start + i}:D{ist_label_start + i}")
        ws.cell(
            row=ist_label_start + i, column=3
        ).alignment = Alignment(horizontal="right")
    _merge_and_center(
        ws,
        f"C{ist_label_start + 2}:D{ist_label_start + 2}",
        "Monatliches Gsmt.einkommen",
        FONT_BOLD,
    )
    _write_formula(
        ws,
        ist_label_start + 2,
        5,
        f"=SUM(E{ist_label_start}:E{ist_label_start + 1})",
    )

    # ── Balance section (right side, merged G/I + J boxes) ──
    # Template boxes: SOLL BALANCE rows 4-5, IST BALANCE rows 6-7,
    # UNTERSCHIED rows 8-9 (no overlap between boxes).
    balance_specs = [
        (
            SOLL_INCOME_HEADER_ROW,
            "SOLL BALANCE \n(Soll Einnahmen minus Ausgaben)",
            f"=E{SOLL_INCOME_HEADER_ROW + 2}-J{total_soll_row}",
        ),
        (
            SOLL_INCOME_HEADER_ROW + 2,
            "IST BALANCE \n(Ist Einnahmen minus Ausgaben)",
            f"=E{ist_label_start + 2}-J{total_ist_row}",
        ),
        (
            IST_INCOME_HEADER_ROW,
            "UNTERSCHIED \n(Ist minus soll)",
            f"=J{SOLL_INCOME_HEADER_ROW + 2}-J{SOLL_INCOME_HEADER_ROW}",
        ),
    ]
    for row, label, formula in balance_specs:
        _merge_and_center(
            ws, f"G{row}:I{row + 1}", label, FONT_SECTION, wrap=True
        )
        _merge_and_center(
            ws, f"J{row}:J{row + 1}", formula, FONT_BOLD, wrap=False
        )
        ws[f"J{row}"].fill = TOTAL_FILL
        ws[f"J{row}"].number_format = EURO_NUMBER_FORMAT
    _style_balance_boxes(
        ws,
        [
            SOLL_INCOME_HEADER_ROW,
            SOLL_INCOME_HEADER_ROW + 2,
            IST_INCOME_HEADER_ROW,
            SOLL_INCOME_HEADER_ROW + 1,
            SOLL_INCOME_HEADER_ROW + 3,
            IST_INCOME_HEADER_ROW + 1,
        ],
    )


def _write_category_block(
    ws: Worksheet,
    block: list[tuple[Category, list]],
    start_row: int,
    label_col: int,
    soll_col: int,
    ist_col: int,
    diff_col: int,
) -> int:
    """Write one side-by-side category block as a styled Excel table.

    Each category is written as:
      - header row: UPPERCASE name + "Geschätzte Kosten" / "Tatsächl. Kosten"
        / "Unterschied" (dark teal fill, white bold text)
      - banded item rows (light teal on alternate rows) with a per-row
        difference formula
      - a "Zwischensumme" subtotal row (double top border) with SUM + diff

    Returns the first free row below the block.
    """
    row = start_row
    for cat, items in block:
        # Header row (UPPERCASE like the template)
        headers = [cat.name.upper(), "Geschätzte Kosten", "Tatsächl. Kosten", "Unterschied"]
        for i, header in enumerate(headers):
            cell = ws.cell(row=row, column=label_col + i, value=header)
            cell.font = FONT_WHITE_BOLD
            cell.fill = HEADER_FILL
            cell.border = TABLE_BORDER
            cell.alignment = Alignment(horizontal="center", vertical="center")
        row += 1

        item_start = row
        soll_letter = get_column_letter(soll_col)
        ist_letter = get_column_letter(ist_col)

        for idx, item in enumerate(items):
            soll = item.projected_cost or Decimal("0")
            ist = item.actual_cost or Decimal("0")
            label_cell = ws.cell(row=row, column=label_col, value=item.label)
            label_cell.font = FONT_BODY
            label_cell.border = TABLE_BORDER
            _write_number(ws, row, soll_col, soll)
            ws.cell(row=row, column=soll_col).border = TABLE_BORDER
            _write_number(ws, row, ist_col, ist)
            ws.cell(row=row, column=ist_col).border = TABLE_BORDER
            diff = ws.cell(
                row=row,
                column=diff_col,
                value=f"={soll_letter}{row}-{ist_letter}{row}",
            )
            diff.number_format = EURO_NUMBER_FORMAT
            diff.border = TABLE_BORDER
            # Banded rows (alternate light teal like the template's stripe)
            if idx % 2 == 1:
                for col in range(label_col, diff_col + 1):
                    ws.cell(row=row, column=col).fill = BAND_FILL
            row += 1
        item_end = row - 1

        # Zwischensumme (subtotal) row
        cell = ws.cell(row=row, column=label_col, value="Zwischensumme")
        cell.font = FONT_BOLD
        cell.border = TABLE_BORDER
        if items:
            _write_formula(
                ws, row, soll_col,
                f"=SUM({soll_letter}{item_start}:{soll_letter}{item_end})",
            )
            _write_formula(
                ws, row, ist_col,
                f"=SUM({ist_letter}{item_start}:{ist_letter}{item_end})",
            )
        else:
            _write_number(ws, row, soll_col, Decimal("0"))
            _write_number(ws, row, ist_col, Decimal("0"))
        for col in range(soll_col, diff_col + 1):
            ws.cell(row=row, column=col).border = TABLE_BORDER
            ws.cell(row=row, column=col).fill = TOTAL_FILL
        diff = ws.cell(
            row=row,
            column=diff_col,
            value=f"={soll_letter}{row}-{ist_letter}{row}",
        )
        diff.number_format = EURO_NUMBER_FORMAT
        diff.font = FONT_BOLD
        # Double top border on the totals row (like the template style)
        ws.cell(row=row, column=label_col).border = Border(
            top=Side(style="double", color=TEAL),
            left=THIN_TEAL, right=THIN_TEAL, bottom=THIN_TEAL,
        )
        row += 1

    return row


def _block_row_count(block: list[tuple[Category, list]]) -> int:
    """Number of rows a category block occupies (headers + items + subtotals)."""
    return sum(2 + len(items) for _, items in block)


def _write_diagramme_sheet(wb: Workbook, budget: Budget) -> None:
    """Write the DIAGRAMME chart sheet like the original template.

    The original's DIAGRAMME sheet lists (Category, Subcategory, Cost) using
    formulas pointing at the BUDGET sheet's IST column cells. We recreate the
    same structure for the first few item rows of each category.
    """
    ws = wb.create_sheet("DIAGRAMME")
    ws.append(["Category", "Subcategory", "Cost"])

    groups = _category_groups(budget)
    # The template lists at most ~2 rows per category at fixed BUDGET rows;
    # we point them at the actual item rows we wrote (left block rows for the
    # first categories, right block rows for later ones). For simplicity we
    # generate the links from the data we know we wrote: each category's items
    # start at its header+1 row in its block.
    for cat, items in groups:
        if not items:
            continue
        # Skip this detailed linkage — the DIAGRAMME rows reference the BUDGET
        # rows directly below the category headers, which we computed during
        # writing. To keep this helper self-contained we just emit the label
        # rows with placeholder references; they are cosmetic like the
        # original's (which also had #REF! entries).
        for item in items[:2]:
            ws.append([cat.name, item.label, None])


def build_budget_excel(budget: Budget, db: Session) -> bytes:
    """Build an .xlsx file (bytes) representing the given budget.

    Loads the budget's categories/items/incomes fresh from the DB so the
    caller can pass a budget with unloaded relationships.

    Returns:
        The raw .xlsx file bytes.
    """
    loaded = db.scalar(
        select(Budget)
        .where(Budget.id == budget.id)
        .options(
            selectinload(Budget.categories).selectinload(Category.items),
            selectinload(Budget.incomes),
        )
    )
    if loaded is None:
        loaded = budget

    # ── Distribute categories across the two blocks first (so we can compute
    #    the totals rows before writing the income balance formulas). ────────
    groups = _category_groups(loaded)
    left_block: list = []
    right_block: list = []
    for idx, (cat, items) in enumerate(groups):
        # Empty categories go to the left block so they are not lost.
        if not items or idx % 2 == 0:
            left_block.append((cat, items))
        else:
            right_block.append((cat, items))

    # Totals sit directly below the taller of the two category blocks.
    last_cat_row = (
        CATEGORY_START_ROW
        - 1
        + max(_block_row_count(left_block), _block_row_count(right_block))
    )
    total_soll_row = last_cat_row + 1
    total_ist_row = total_soll_row + 2
    total_diff_row = total_soll_row + 4

    wb = Workbook()

    # ── BUDGET sheet ──────────────────────────
    ws = wb.active
    ws.title = "BUDGET"
    _set_worksheet_widths(ws)

    # Row 2: title
    title_cell = ws["B2"]
    title_cell.value = _title_block_title(loaded)
    title_cell.font = FONT_TITLE
    title_cell.border = TITLE_BORDER
    ws.row_dimensions[2].height = TITLE_ROW_HEIGHT

    # ── Income + balance section ──────────────
    _write_income_section(ws, loaded, total_soll_row, total_ist_row)

    # ── Categories ─────────────────────────────
    _write_category_block(ws, left_block, CATEGORY_START_ROW, *LEFT_BLOCK)
    _write_category_block(ws, right_block, CATEGORY_START_ROW, *RIGHT_BLOCK)

    # ── Totals section (bottom right, merged rows) ──
    l_soll, l_ist = "C", "D"      # left block SOLL/IST columns
    r_soll, r_ist = "H", "I"      # right block SOLL/IST columns
    total_formulas = {
        total_soll_row: (
            f"=SUM({l_soll}{CATEGORY_START_ROW}:{l_soll}{last_cat_row},"
            f"{r_soll}{CATEGORY_START_ROW}:{r_soll}{last_cat_row})"
        ),
        total_ist_row: (
            f"=SUM({l_ist}{CATEGORY_START_ROW}:{l_ist}{last_cat_row},"
            f"{r_ist}{CATEGORY_START_ROW}:{r_ist}{last_cat_row})"
        ),
        total_diff_row: f"=J{total_soll_row}-J{total_ist_row}",
    }
    for label, row in (
        ("SOLL GESAMTKOSTEN", total_soll_row),
        ("IST GESAMTKOSTEN", total_ist_row),
        ("GESAMTUNTERSCHIED", total_diff_row),
    ):
        _merge_and_center(ws, f"G{row}:I{row + 1}", label, FONT_SECTION, wrap=True)
        # Write the formula BEFORE merging so the top-left cell holds it
        _merge_and_center(
            ws, f"J{row}:J{row + 1}", total_formulas[row], FONT_BOLD, wrap=False
        )
        ws[f"J{row}"].fill = TOTAL_FILL
        ws[f"J{row}"].number_format = EURO_NUMBER_FORMAT
        _style_balance_boxes(ws, [row])

    # ── DIAGRAMME sheet ───────────────────────
    _write_diagramme_sheet(wb, loaded)

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
