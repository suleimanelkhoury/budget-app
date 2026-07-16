"""Excel import service — parse .xlsx files and create budgets from them.

Supports the personal monthly budget template, which has a two-column-block
layout:

  - Column A: instruction text (ignored)
  - Left block:  label=col B, SOLL (projected)=col C, IST (actual)=col D
  - Right block: label=col G, SOLL (projected)=col H, IST (actual)=col I
  - Income: labels in col C, values in col E, split into SOLL rows (4-5)
            and IST rows (8-9)

Category headers are uppercase (WOHNEN, TRANSPORT, …) and are followed by a
sub-header row ("Geschätzte Kosten", "Tatsächl. Kosten", "Unterschied").
"Zwischensumme" rows are subtotals and are skipped.

Also supports a simpler single-block layout (Label | SOLL | IST in the first
three columns) as a fallback.
"""

from decimal import Decimal, InvalidOperation
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense_item import ExpenseItem
from app.models.income import Income
from app.models.user import User

# Known category names from the spec — used to detect category header rows.
# Matching is case-insensitive. These are the *top-level* category headers
# from the personal budget template (always UPPERCASE in the file).
# Item-level labels like "Lebensmittel" are NOT here — they're items.
KNOWN_CATEGORIES = {
    "wohnen",
    "transport",
    "essen",
    "entertainment",
    "versicherung",
    "investitionen",
    "haustiere",
    "geschenke",
    "persönliche pflege",
    "personal care",
    "legal",
    "bank konto",
    "bank",
    "steuer",
    "steuern",
}

# Known income labels (case-insensitive)
INCOME_LABELS = {
    "einkommen",
    "extra",
    "gehalt",
    "salary",
    "nebeneinkunft",
    "nettoeinkommen",
    "netto",
    "brutto",
    "zusatzeinkommen",
    "zusätzliches einkommen",
}

# Labels that indicate a subtotal/total row to skip
SUBTOTAL_LABELS = {
    "zwischensumme",
    "gesamt",
    "gesamtkosten",
    "total",
    "summe",
    "subtotal",
    "balance",
    "bilanz",
    "ergebnis",
    "überschuss",
    "defizit",
    "monatliches gsmt.einkommen",
    "monatliches gesamt.einkommen",
    "monatliches gesamteinkommen",
}

# Sub-header labels that appear on category header rows
SUB_HEADER_LABELS = {
    "geschätzte kosten",
    "tatsächl. kosten",
    "tatsächliche kosten",
    "unterschied",
    "estimated cost",
    "actual cost",
    "difference",
}

# Instructional / header keywords to skip
SKIP_LABELS = {
    "label",
    "bezeichnung",
    "name",
    "kategorie",
    "item",
    "soll",
    "ist",
    "beschreibung",
    "posten",
    "soll monatliches einkommen",
    "ist monatliches einkommen",
    "soll balance",
    "ist balance",
    "unterschied",
    "soll gesamtkosten",
    "ist gesamtkosten",
    "gesamtunterschied",
}


def _to_decimal(value: object) -> Decimal:
    """Safely convert a cell value to Decimal, returning 0 for blanks/errors."""
    if value is None:
        return Decimal("0")
    if isinstance(value, int | float | Decimal):
        return Decimal(str(value))
    if isinstance(value, str):
        try:
            # Handle German number format: "1.234,56" → "1234.56"
            cleaned = value.strip().replace(".", "").replace(",", ".")
            # Strip currency symbols and spaces
            cleaned = cleaned.replace("€", "").replace("EUR", "").strip()
            return Decimal(cleaned)
        except InvalidOperation:
            return Decimal("0")
    return Decimal("0")


def _clean_label(value: object) -> str:
    """Extract a cleaned label string from a cell value."""
    if value is None:
        return ""
    return str(value).strip()


def _is_category_header(label: str) -> bool:
    """Check if a row label matches a known category name (case-insensitive)."""
    return label.strip().lower() in KNOWN_CATEGORIES


def _is_income_label(label: str) -> bool:
    """Check if a row label matches a known income label (case-insensitive)."""
    return label.strip().lower() in INCOME_LABELS


def _is_subtotal(label: str) -> bool:
    """Check if a row is a subtotal/total row."""
    return label.strip().lower() in SUBTOTAL_LABELS


def _is_sub_header(label: str) -> bool:
    """Check if a row is a sub-header (Geschätzte Kosten, etc.)."""
    return label.strip().lower() in SUB_HEADER_LABELS


def _is_skip_label(label: str) -> bool:
    """Check if a row should be skipped (instructions, headers, totals)."""
    lower = label.strip().lower()
    if lower in SKIP_LABELS:
        return True
    # Skip long instruction sentences (column A in the template)
    if len(label) > 60:
        return True
    # Skip labels with newlines (e.g. "SOLL BALANCE \n(...)")
    if "\n" in label:
        return True
    return False


def _row_has_numbers(
    ws: object, row: int, soll_col: int, ist_col: int
) -> bool:
    """Check if a row has any non-zero numeric value in the SOLL or IST columns."""
    soll = _to_decimal(ws.cell(row=row, column=soll_col).value)  # type: ignore[attr-defined]
    ist = _to_decimal(ws.cell(row=row, column=ist_col).value)  # type: ignore[attr-defined]
    return soll != Decimal("0") or ist != Decimal("0")


def _detect_layout(ws: object) -> list[tuple[int, int, int]]:
    """Detect the column blocks in the sheet.

    Returns a list of (label_col, soll_col, ist_col) tuples — one per
    side-by-side block. The personal budget template has two blocks:
      - Left:  (2, 3, 4)   → B, C, D
      - Right: (7, 8, 9)   → G, H, I

    Falls back to a single block (1, 2, 3) if no headers are found.
    """
    blocks: list[tuple[int, int, int]] = []
    # Scan the first 15 rows for "Geschätzte Kosten" / "Tatsächl. Kosten" pairs
    for r in range(1, 16):
        for c in range(1, (ws.max_column or 15) + 1):  # type: ignore[attr-defined]
            val = _clean_label(ws.cell(row=r, column=c).value)  # type: ignore[attr-defined]
            if val.lower() in ("geschätzte kosten", "estimated cost", "soll", "projected"):
                # Found a SOLL column — check the next column for IST
                next_val = _clean_label(
                    ws.cell(row=r, column=c + 1).value  # type: ignore[attr-defined]
                )
                if next_val.lower() in (
                    "tatsächl. kosten",
                    "tatsächliche kosten",
                    "ist",
                    "actual",
                ):
                    # Label column is one to the left
                    label_col = c - 1
                    if label_col >= 1:
                        blocks.append((label_col, c, c + 1))

    # Deduplicate (in case the same block is detected on multiple rows)
    seen: set[tuple[int, int, int]] = set()
    unique_blocks: list[tuple[int, int, int]] = []
    for b in blocks:
        if b not in seen:
            seen.add(b)
            unique_blocks.append(b)

    # Fallback: single block in columns 1/2/3
    if not unique_blocks:
        unique_blocks = [(1, 2, 3)]

    return unique_blocks


def _detect_income_layout(
    ws: object, max_row: int
) -> tuple[int, int, int, int] | None:
    """Detect the income section layout.

    The personal budget template puts income labels in column C with values
    in column E, split into SOLL rows (4-5) and IST rows (8-9).

    Returns (label_col, value_col, soll_start_row, ist_start_row) or None.
    Only returns a layout when the two-block template structure is detected
    (i.e. the value column is different from the SOLL/IST columns used by
    the simple block layout).
    """
    # Look for "Einkommen" in the first 5 columns with a number 2-3 columns
    # to the right (the template has label in col C, value in col E).
    for r in range(1, min(max_row + 1, 20)):
        for c in range(1, 6):
            val = _clean_label(ws.cell(row=r, column=c).value)  # type: ignore[attr-defined]
            if val.lower() == "einkommen":
                # Check if there's a number a couple columns to the right
                for vc in range(c + 1, c + 4):
                    cell_val = ws.cell(row=r, column=vc).value  # type: ignore[attr-defined]
                    if isinstance(cell_val, int | float) and cell_val != 0:
                        # Only use this layout if the value column is at least
                        # 2 columns away from the label (template style).
                        # In the simple layout, SOLL is in label_col+1.
                        if vc <= c + 1:
                            continue
                        # Found the income value column. Now find the IST
                        # income block by looking for another "Einkommen"
                        # label below with a number in the same value column.
                        for r2 in range(r + 1, min(max_row + 1, r + 10)):
                            val2 = _clean_label(
                                ws.cell(row=r2, column=c).value  # type: ignore[attr-defined]
                            )
                            if val2.lower() == "einkommen":
                                return (c, vc, r, r2)
                        # If no separate IST block, this is not the template
                        # layout — fall back to the simple block parser.
                        return None
    return None


def _parse_income_from_template(
    ws: object,
    layout: tuple[int, int, int, int],
    budget_id: int,
) -> list[Income]:
    """Parse income from the personal budget template layout.

    The template has SOLL income rows and IST income rows separately.
    We match them by label (Einkommen, Extra) and merge into a single
    Income entry with projected_amount from SOLL and actual_amount from IST.
    """
    label_col, value_col, soll_start, ist_start = layout
    incomes: list[Income] = []
    income_map: dict[str, Income] = {}

    # Read SOLL income rows (soll_start and the next few rows)
    for r in range(soll_start, min(soll_start + 5, (ws.max_row or 0) + 1)):  # type: ignore[attr-defined]
        label = _clean_label(ws.cell(row=r, column=label_col).value)  # type: ignore[attr-defined]
        if not label or _is_subtotal(label) or _is_skip_label(label):
            continue
        if not _is_income_label(label):
            continue
        projected = _to_decimal(ws.cell(row=r, column=value_col).value)  # type: ignore[attr-defined]
        if label not in income_map:
            income_map[label] = Income(
                budget_id=budget_id,
                label=label,
                projected_amount=projected,
                actual_amount=Decimal("0"),
            )
        else:
            income_map[label].projected_amount = projected

    # Read IST income rows (ist_start and the next few rows)
    for r in range(ist_start, min(ist_start + 5, (ws.max_row or 0) + 1)):  # type: ignore[attr-defined]
        label = _clean_label(ws.cell(row=r, column=label_col).value)  # type: ignore[attr-defined]
        if not label or _is_subtotal(label) or _is_skip_label(label):
            continue
        if not _is_income_label(label):
            continue
        actual = _to_decimal(ws.cell(row=r, column=value_col).value)  # type: ignore[attr-defined]
        if label not in income_map:
            income_map[label] = Income(
                budget_id=budget_id,
                label=label,
                projected_amount=Decimal("0"),
                actual_amount=actual,
            )
        else:
            income_map[label].actual_amount = actual

    incomes = list(income_map.values())
    return incomes


def parse_excel_and_create_budget(
    file_bytes: bytes,
    user: User,
    db: Session,
) -> tuple[Budget, int, int, int]:
    """Parse an Excel file and create a budget with all its data.

    Args:
        file_bytes: The raw bytes of the .xlsx file.
        user: The user who will own the created budget.
        db: The database session.

    Returns:
        A tuple of (budget, categories_count, income_count, items_count).

    Raises:
        ValueError: If the file cannot be parsed or has no valid data.
    """
    try:
        wb = load_workbook(BytesIO(file_bytes), data_only=True)
    except Exception as exc:
        raise ValueError(f"Could not read Excel file: {exc}") from exc

    ws = wb.active
    if ws is None:
        raise ValueError("Excel file has no active worksheet.")

    max_row = ws.max_row or 0

    # ── Detect the budget title ───────────────
    # The template puts the title in B2 (e.g. "JANUAR 2026 BUDGET").
    # Fall back to the sheet name (simple layout uses sheet name as title).
    budget_title = ""
    for r in range(1, min(max_row + 1, 5)):
        for c in range(1, 6):
            raw = ws.cell(row=r, column=c).value
            if not isinstance(raw, str):
                continue  # Skip numbers, dates, etc.
            val = _clean_label(raw)
            if not val or _is_skip_label(val) or _is_category_header(val):
                continue
            # Title-like: contains a year, or is all-caps with "BUDGET"
            if (
                ("BUDGET" in val.upper() and len(val) < 60)
                or any(word.isdigit() and 1900 <= int(word) <= 2100
                       for word in val.split() if word.isdigit())
            ):
                budget_title = val
                break
        if budget_title:
            break

    # Fall back to the sheet name (simple layout sets ws.title to the budget title)
    if not budget_title:
        sheet_title = ws.title.strip() if ws.title else ""
        if sheet_title and not _is_skip_label(sheet_title):
            budget_title = sheet_title

    if not budget_title:
        budget_title = "Imported Budget"

    # ── Create the budget ──────────────────────
    budget = Budget(
        user_id=user.id,
        title=budget_title,
        month=1,  # Default; overridden by _try_parse_title_for_date
        year=2026,
    )
    _try_parse_title_for_date(budget_title, budget)

    db.add(budget)
    db.flush()

    # ── Detect column blocks ───────────────────
    blocks = _detect_layout(ws)

    # ── Parse income ───────────────────────────
    incomes: list[Income] = []
    income_layout = _detect_income_layout(ws, max_row)
    if income_layout is not None:
        incomes = _parse_income_from_template(ws, income_layout, budget.id)
    else:
        # Fallback: income in the first block's label/SOLL/IST columns
        label_col, soll_col, ist_col = blocks[0]
        for r in range(1, max_row + 1):
            label = _clean_label(ws.cell(row=r, column=label_col).value)
            if not label or _is_skip_label(label) or _is_subtotal(label):
                continue
            if _is_income_label(label):
                projected = _to_decimal(
                    ws.cell(row=r, column=soll_col).value
                )
                actual = _to_decimal(
                    ws.cell(row=r, column=ist_col).value
                )
                incomes.append(
                    Income(
                        budget_id=budget.id,
                        label=label,
                        projected_amount=projected,
                        actual_amount=actual,
                    )
                )

    # ── Parse categories and items ─────────────
    categories: list[Category] = []
    items_count = 0

    for label_col, soll_col, ist_col in blocks:
        current_category: Category | None = None

        for r in range(1, max_row + 1):
            label = _clean_label(ws.cell(row=r, column=label_col).value)

            if not label:
                continue

            # Skip instruction text, headers, subtotals, sub-headers
            if _is_skip_label(label):
                continue
            if _is_subtotal(label):
                continue
            if _is_sub_header(label):
                continue
            # Skip income labels (handled above)
            if _is_income_label(label):
                continue

            # ── Category header ──────────────────
            # Known category name, OR an uppercase label with no numbers
            # (the template uses UPPERCASE category names like "WOHNEN").
            # Exclude the budget title and labels containing "BUDGET".
            if label.upper() == budget_title.upper() or "BUDGET" in label.upper():
                continue
            is_known = _is_category_header(label)
            is_uppercase = (
                label == label.upper()
                and len(label) <= 40
                and any(c.isalpha() for c in label)
                and not _row_has_numbers(ws, r, soll_col, ist_col)
            )
            if is_known or is_uppercase:
                # Avoid duplicate categories across blocks
                if not any(cat.name.lower() == label.lower() for cat in categories):
                    current_category = Category(
                        budget_id=budget.id,
                        name=label.title(),  # Normalize to Title Case
                        sort_order=len(categories),
                    )
                    db.add(current_category)
                    db.flush()
                    categories.append(current_category)
                else:
                    # Find the existing category to add items to it
                    current_category = next(
                        cat for cat in categories
                        if cat.name.lower() == label.lower()
                    )
                continue

            # ── Expense item ─────────────────────
            if current_category is not None:
                projected = _to_decimal(
                    ws.cell(row=r, column=soll_col).value
                )
                actual = _to_decimal(
                    ws.cell(row=r, column=ist_col).value
                )
                # Only add items that have a label and at least one number
                if projected != Decimal("0") or actual != Decimal("0"):
                    db.add(
                        ExpenseItem(
                            category_id=current_category.id,
                            label=label,
                            projected_cost=projected,
                            actual_cost=actual,
                        )
                    )
                    items_count += 1

    # Add income entries
    for income in incomes:
        db.add(income)

    # ── Validate ──────────────────────────────
    if not categories and not incomes:
        raise ValueError(
            "No valid budget data found in the Excel file. "
            "Expected categories (Wohnen, Transport, etc.) and/or income rows."
        )

    db.commit()
    db.refresh(budget)

    return budget, len(categories), len(incomes), items_count


# German month names for parsing titles like "Juli 2026"
GERMAN_MONTHS = {
    "januar": 1,
    "februar": 2,
    "märz": 3,
    "april": 4,
    "mai": 5,
    "juni": 6,
    "juli": 7,
    "august": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "dezember": 12,
}


def _try_parse_title_for_date(title: str, budget: Budget) -> None:
    """Try to extract month and year from a title like 'Juli 2026'."""
    parts = title.lower().split()
    for part in parts:
        if part in GERMAN_MONTHS:
            budget.month = GERMAN_MONTHS[part]
        elif part.isdigit() and 1900 <= int(part) <= 2100:
            budget.year = int(part)
