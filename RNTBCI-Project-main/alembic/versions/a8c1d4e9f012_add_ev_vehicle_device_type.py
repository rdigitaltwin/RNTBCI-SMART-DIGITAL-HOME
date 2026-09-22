"""add ev_vehicle to PostgreSQL DeviceType enum

Revision ID: a8c1d4e9f012
Revises: 62c7ca2ec54e
Create Date: 2026-09-05

SQLAlchemy Enum(DeviceType) stores member names (EV_VEHICLE), not values.
create_all does not alter existing Postgres enums, so inserts fail with 500
until this label exists.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "a8c1d4e9f012"
down_revision: Union[str, None] = "62c7ca2ec54e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute(text("ALTER TYPE devicetype ADD VALUE IF NOT EXISTS 'EV_VEHICLE'"))
        op.execute(text("ALTER TYPE devicetype ADD VALUE IF NOT EXISTS 'ev_vehicle'"))


def downgrade() -> None:
    # PostgreSQL cannot drop enum labels without recreating the type.
    pass
