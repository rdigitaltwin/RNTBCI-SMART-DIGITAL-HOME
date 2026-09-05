"""add execution_mode to devices

Revision ID: b1c2d3e4f567
Revises: a8c1d4e9f012
Create Date: 2026-01-01 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f567'
down_revision = 'a8c1d4e9f012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'devices',
        sa.Column('execution_mode', sa.String(20), nullable=False, server_default='simulation')
    )


def downgrade() -> None:
    op.drop_column('devices', 'execution_mode')
