"""Excel import router — upload .xlsx and create a budget from it."""

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestError
from app.models.user import User
from app.schemas.excel import ExcelImportResponse
from app.services.excel_import import parse_excel_and_create_budget

router = APIRouter(prefix="/api/budgets", tags=["excel-import"])


@router.post(
    "/import",
    response_model=ExcelImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import a budget from an Excel file",
)
async def import_budget(
    file: UploadFile = File(..., description="A .xlsx file to import"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExcelImportResponse:
    """Upload an .xlsx file and create a budget from it.

    The Excel file should contain:
    - Income rows (Einkommen, Extra) with SOLL/IST columns
    - Category headers (Wohnen, Transport, Essen, etc.)
    - Expense items under each category with SOLL/IST columns
    """
    # Validate file type
    if not file.filename:
        raise BadRequestError(
            detail_en="No filename provided.",
            detail_de="Kein Dateiname angegeben.",
        )
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise BadRequestError(
            detail_en="File must be an Excel file (.xlsx or .xls).",
            detail_de="Die Datei muss eine Excel-Datei sein (.xlsx oder .xls).",
        )

    # Read file contents
    file_bytes = await file.read()
    if not file_bytes:
        raise BadRequestError(
            detail_en="Uploaded file is empty.",
            detail_de="Die hochgeladene Datei ist leer.",
        )

    # Parse and create the budget
    try:
        budget, cat_count, income_count, items_count = parse_excel_and_create_budget(
            file_bytes, current_user, db
        )
    except ValueError as exc:
        raise BadRequestError(
            detail_en=str(exc),
            detail_de=f"Excel-Import fehlgeschlagen: {exc}",
        ) from exc

    return ExcelImportResponse(
        budget_id=budget.id,
        budget_title=budget.title,
        categories_imported=cat_count,
        income_imported=income_count,
        items_imported=items_count,
    )
