"""Add shunt meter, device EPM, and metering category tables.

Revision ID: f8d4a6b91c10
Revises: e5b7c91d4a02
Create Date: 2026-10-29

Additive only. Existing tables and columns are unchanged.
Seed uses INSERT ... WHERE NOT EXISTS so existing rows are never overwritten.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "f8d4a6b91c10"
down_revision: Union[str, None] = "e5b7c91d4a02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS device_metering_categories (
            device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
            category INTEGER NOT NULL,
            meter_type VARCHAR(16) NOT NULL
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS shunt_meters (
            meter_id VARCHAR(32) PRIMARY KEY,
            device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
            role VARCHAR(16) NOT NULL DEFAULT 'device',
            voltage DOUBLE PRECISION NOT NULL DEFAULT 0,
            current DOUBLE PRECISION NOT NULL DEFAULT 0,
            power DOUBLE PRECISION NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_posted_at TIMESTAMP WITH TIME ZONE
        )
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_shunt_meters_device_id ON shunt_meters (device_id)
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS device_epm (
            device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
            voltage DOUBLE PRECISION NOT NULL DEFAULT 0,
            current DOUBLE PRECISION NOT NULL DEFAULT 0,
            power DOUBLE PRECISION NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_posted_at TIMESTAMP WITH TIME ZONE
        )
    """))

    from backend.utils.seed_shunt_meters import seed_shunt_metering_sql

    seed_shunt_metering_sql(op.get_bind())


def downgrade() -> None:
    op.execute(text("DROP TABLE IF EXISTS device_epm"))
    op.execute(text("DROP TABLE IF EXISTS shunt_meters"))
    op.execute(text("DROP TABLE IF EXISTS device_metering_categories"))
