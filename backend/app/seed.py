"""Seed script — populate the database with sample data for July 2026.

Usage:
    python -m app.seed

This will:
  1. Run migrations to create tables (if needed)
  2. Create a demo user (demo@budget.app / demopassword)
  3. Create a "Juli 2026" budget with all categories, income, and expense items
"""

from decimal import Decimal
from typing import TYPE_CHECKING

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password  # — created in Section 3
from app.models import Budget, Category, ExpenseItem, Income, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def seed() -> None:
    """Seed the database with sample data."""
    # Create tables if they don't exist (dev convenience; use Alembic in prod)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # ── Check if already seeded ───────────────
        existing = db.query(User).filter_by(email="demo@budget.app").first()
        if existing:
            print("Database already seeded. Skipping.")
            return

        # ── Demo user ─────────────────────────────
        user = User(
            email="demo@budget.app",
            password_hash=hash_password("demopassword"),
        )
        db.add(user)
        db.flush()  # get user.id

        # ── Budget: Juli 2026 ─────────────────────
        budget = Budget(
            user_id=user.id,
            title="Juli 2026",
            month=7,
            year=2026,
        )
        db.add(budget)
        db.flush()  # get budget.id

        # ── Income ────────────────────────────────
        incomes = [
            Income(
                budget_id=budget.id,
                label="Einkommen",
                projected_amount=Decimal("2500.00"),
                actual_amount=Decimal("2500.00"),
            ),
            Income(
                budget_id=budget.id,
                label="Extra",
                projected_amount=Decimal("300.00"),
                actual_amount=Decimal("450.00"),
            ),
        ]
        db.add_all(incomes)

        # ── Categories & Expense Items ────────────
        # Based on the Excel structure from the spec notes
        categories_data = [
            (
                "Wohnen",
                [
                    ("Miete", "900.00", "900.00"),
                    ("Strom", "80.00", "75.50"),
                    ("Wasser", "40.00", "38.00"),
                    ("Internet", "35.00", "35.00"),
                    ("Müllabfuhr", "20.00", "20.00"),
                ],
            ),
            (
                "Transport",
                [
                    ("Benzin", "150.00", "165.00"),
                    ("Versicherung Auto", "50.00", "50.00"),
                    ("ÖPNV Ticket", "49.00", "49.00"),
                ],
            ),
            (
                "Essen",
                [
                    ("Lebensmittel", "400.00", "420.00"),
                    ("Restaurant", "100.00", "130.00"),
                    ("Kaffee", "30.00", "25.00"),
                ],
            ),
            (
                "Entertainment",
                [
                    ("Streaming", "25.00", "25.00"),
                    ("Kino", "40.00", "15.00"),
                    ("Spiele", "50.00", "0.00"),
                ],
            ),
            (
                "Versicherung",
                [
                    ("Krankenversicherung", "120.00", "120.00"),
                    ("Haftpflicht", "10.00", "10.00"),
                ],
            ),
            (
                "Investitionen",
                [
                    ("Sparplan ETF", "200.00", "200.00"),
                    ("Bausparvertrag", "50.00", "50.00"),
                ],
            ),
            (
                "Haustiere",
                [
                    ("Futter", "60.00", "55.00"),
                    ("Tierarzt", "30.00", "0.00"),
                ],
            ),
            (
                "Geschenke",
                [
                    ("Geburtstag", "50.00", "35.00"),
                ],
            ),
            (
                "Persönliche Pflege",
                [
                    ("Friseur", "25.00", "25.00"),
                    ("Kosmetik", "20.00", "15.00"),
                ],
            ),
            (
                "Legal",
                [
                    ("Anwalt", "0.00", "0.00"),
                ],
            ),
            (
                "Bank Konto",
                [
                    ("Kontoführungsgebühr", "5.00", "5.00"),
                ],
            ),
            (
                "Steuer",
                [
                    ("Steuerberater", "50.00", "50.00"),
                ],
            ),
        ]

        for sort_order, (cat_name, items) in enumerate(categories_data):
            category = Category(
                budget_id=budget.id,
                name=cat_name,
                sort_order=sort_order,
            )
            db.add(category)
            db.flush()

            for label, projected, actual in items:
                db.add(
                    ExpenseItem(
                        category_id=category.id,
                        label=label,
                        projected_cost=Decimal(projected),
                        actual_cost=Decimal(actual),
                    )
                )

        db.commit()
        print("✓ Database seeded successfully!")
        print("  User: demo@budget.app / demopassword")
        print(f"  Budget: {budget.title} ({budget.id})")
        print(f"  Categories: {len(categories_data)}")
        print(
            f"  Income entries: {len(incomes)}, "
            f"Expense items: {sum(len(items) for _, items in categories_data)}"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
