"""Global exception handlers for consistent error responses.

Registered in app/main.py via `register_exception_handlers(app)`.
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger(__name__)


def _get_language(request: Request) -> str:
    """Determine the response language from the Accept-Language header.

    Returns "de" for German, "en" for English (default).
    """
    accept_lang = request.headers.get("Accept-Language", "").lower()
    if accept_lang.startswith("de"):
        return "de"
    return "en"


def _extract_message(detail: object, lang: str) -> str:
    """Extract a human-readable message from an HTTPException detail.

    Handles three cases:
    1. detail is a dict with "en"/"de" keys → pick the right language
    2. detail is a string → return as-is
    3. anything else → stringify
    """
    if isinstance(detail, dict):
        if lang == "de" and "de" in detail:
            return str(detail["de"])
        if "en" in detail:
            return str(detail["en"])
        # Fallback: return first string value
        for value in detail.values():
            if isinstance(value, str):
                return value
        return str(detail)
    return str(detail) if detail else ""


def _error_response(
    request: Request,
    status_code: int,
    message: str,
    detail: object | None = None,
) -> JSONResponse:
    """Build a consistent JSON error response."""
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(
            {
                "error": {
                    "status_code": status_code,
                    "message": message,
                    "detail": detail,
                    "path": str(request.url.path),
                    "method": request.method,
                }
            }
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the FastAPI app."""

    # ── App exceptions (custom, with German/English messages) ──
    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        lang = _get_language(request)
        message = exc.detail_de if lang == "de" else exc.detail_en
        logger.warning(
            "app_exception",
            status_code=exc.status_code,
            path=request.url.path,
            method=request.method,
            message_en=exc.detail_en,
            message_de=exc.detail_de,
        )
        return _error_response(request, exc.status_code, message)

    # ── Generic HTTPException (404, 400, 401, 409, etc.) ──
    # Preserves the original detail, picking the right language if it's a
    # dict with en/de keys.
    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        lang = _get_language(request)
        message = _extract_message(exc.detail, lang) or "Request failed."
        logger.info(
            "http_exception",
            status_code=exc.status_code,
            path=request.url.path,
            method=request.method,
            message=message,
        )
        return _error_response(
            request,
            exc.status_code,
            message,
            detail=exc.headers,
        )

    # ── 422 — Pydantic validation errors ──────
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        lang = _get_language(request)
        message = (
            "Validierungsfehler — bitte überprüfen Sie Ihre Eingaben."
            if lang == "de"
            else "Validation error — please check your input."
        )
        logger.info(
            "validation_error",
            path=request.url.path,
            method=request.method,
            errors=exc.errors(),
        )
        return _error_response(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            message,
            detail=exc.errors(),
        )

    # ── 500 — Internal server error ───────────
    @app.exception_handler(SQLAlchemyError)
    async def database_error_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        lang = _get_language(request)
        message = (
            "Ein Datenbankfehler ist aufgetreten."
            if lang == "de"
            else "A database error occurred."
        )
        logger.error(
            "database_error",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            exc_info=True,
        )
        return _error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, message)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        lang = _get_language(request)
        message = (
            "Ein unerwarteter Fehler ist aufgetreten."
            if lang == "de"
            else "An unexpected error occurred."
        )
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            exc_info=True,
        )
        return _error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, message)
