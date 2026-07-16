"""Pytest configuration and shared fixtures."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app


@pytest.fixture(scope="function")
def db_engine():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Yield a database session bound to the in-memory engine."""
    testing_session_local = sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with the DB dependency overridden to use the test session."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ── Shared auth fixtures ──────────────────────
@pytest.fixture()
def auth_headers(client):
    """Register a user and return Authorization headers with a valid JWT."""
    response = client.post(
        "/api/auth/register",
        json={"email": "testuser@test.com", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def second_auth_headers(client):
    """Register a second user and return their auth headers (for authz tests)."""
    response = client.post(
        "/api/auth/register",
        json={"email": "seconduser@test.com", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def budget(client, auth_headers):
    """Create a budget and return the response dict."""
    response = client.post(
        "/api/budgets/",
        json={"title": "Test Month", "month": 7, "year": 2026},
        headers=auth_headers,
    )
    return response.json()


@pytest.fixture()
def budget_with_data(client, auth_headers, budget):
    """Create a budget with income, a category, and an expense item.

    Returns a dict with budget_id, income_id, category_id, item_id.
    """
    bid = budget["id"]

    # Add income
    r = client.post(
        f"/api/budgets/{bid}/income",
        json={
            "label": "Einkommen",
            "projected_amount": "2500",
            "actual_amount": "2500",
        },
        headers=auth_headers,
    )
    income_id = r.json()["id"]

    # Add category
    r = client.post(
        f"/api/budgets/{bid}/categories",
        json={"name": "Wohnen", "sort_order": 0},
        headers=auth_headers,
    )
    category_id = r.json()["id"]

    # Add expense item
    r = client.post(
        f"/api/categories/{category_id}/items",
        json={"label": "Miete", "projected_cost": "900", "actual_cost": "850"},
        headers=auth_headers,
    )
    item_id = r.json()["id"]

    return {
        "budget_id": bid,
        "income_id": income_id,
        "category_id": category_id,
        "item_id": item_id,
    }
