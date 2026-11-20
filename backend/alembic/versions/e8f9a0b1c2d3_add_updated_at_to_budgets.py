"""add updated_at to budgets

Tracks when a budget was last edited. The stamp is bumped by the
budget endpoints themselves (onupdate) and by every mutating child
endpoint (categories, expense items, income) via services.touch.

Revision ID: e8f9a0b1c2d3
Revises: c5d6e7f8a9b0
Create Date: 2026-11-20 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing budgets start with "now" — their real last-edit time is
    # unknowable, and "edited just before the upgrade" is the most
    # honest placeholder.
    op.add_column(
        'budgets',
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('budgets', 'updated_at')
