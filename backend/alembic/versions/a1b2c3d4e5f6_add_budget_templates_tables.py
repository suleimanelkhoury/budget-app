"""add budget templates tables

Revision ID: a1b2c3d4e5f6
Revises: d70beaa8b478
Create Date: 2026-07-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd70beaa8b478'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── budget_templates ───────────────────────
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

    # ── template_categories ────────────────────
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

    # ── template_items ─────────────────────────
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


def downgrade() -> None:
    with op.batch_alter_table('template_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_template_items_category_id'))
        batch_op.drop_index(batch_op.f('ix_template_items_id'))

    op.drop_table('template_items')

    with op.batch_alter_table('template_categories', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_template_categories_template_id'))
        batch_op.drop_index(batch_op.f('ix_template_categories_id'))

    op.drop_table('template_categories')

    with op.batch_alter_table('budget_templates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_budget_templates_user_id'))
        batch_op.drop_index(batch_op.f('ix_budget_templates_id'))

    op.drop_table('budget_templates')
