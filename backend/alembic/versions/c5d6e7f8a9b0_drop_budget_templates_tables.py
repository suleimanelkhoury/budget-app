"""drop budget templates tables

The Templates feature was removed in favor of cloning an existing
budget into the next month (POST /api/budgets/{id}/clone) — last
month's budget is the natural recurring template.

Revision ID: c5d6e7f8a9b0
Revises: b3c4d5e6f7a8
Create Date: 2026-11-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop children first (FKs: template_items → template_categories →
    # budget_templates)
    op.drop_table('template_items')
    op.drop_table('template_categories')
    op.drop_table('budget_templates')


def downgrade() -> None:
    # Recreate the template tables (data is not recoverable)
    op.create_table('budget_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('budget_templates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_budget_templates_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_budget_templates_user_id'), ['user_id'], unique=False)

    op.create_table('template_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['budget_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('template_categories', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_template_categories_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_template_categories_template_id'), ['template_id'], unique=False)

    op.create_table('template_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['template_categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('template_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_template_items_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_template_items_category_id'), ['category_id'], unique=False)
