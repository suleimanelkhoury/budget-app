"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth_router,
    budgets_router,
    categories_router,
    excel_import_router,
    expense_items_router,
    income_router,
    summary_router,
    templates_router,
)
from app.core.config import settings
from app.core.exception_handlers import register_exception_handlers
from app.core.logging import get_logger, setup_logging

# Initialize structured logging
setup_logging(debug=settings.DEBUG)
logger = get_logger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
)

# Register global exception handlers
register_exception_handlers(app)

# CORS — allow the frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("app_starting", app_name=settings.APP_NAME, version=settings.APP_VERSION)

# ── Routers ──────────────────────────────────
app.include_router(auth_router)
app.include_router(budgets_router)
app.include_router(income_router)
app.include_router(categories_router)
app.include_router(expense_items_router)
app.include_router(summary_router)
app.include_router(excel_import_router)
app.include_router(templates_router)


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Budget App API — see /docs for documentation"}
