"""Seed Matter clusters and attributes per device type.

Revision ID: c3a9e1b74d20
Revises: f7fa0b3b8e65
Create Date: 2026-10-15

Additive only: creates two catalog tables and inserts missing rows.
Existing rows are left unchanged (ON CONFLICT DO NOTHING).
"""
import uuid
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "c3a9e1b74d20"
down_revision: Union[str, None] = "f7fa0b3b8e65"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS matter_device_clusters (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            device_type VARCHAR(64) NOT NULL,
            endpoint_id INTEGER NOT NULL DEFAULT 1,
            cluster_id VARCHAR(16) NOT NULL,
            cluster_name VARCHAR(128) NOT NULL,
            CONSTRAINT uq_matter_device_cluster UNIQUE (device_type, endpoint_id, cluster_id)
        )
    """))
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS matter_cluster_attributes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            device_type VARCHAR(64) NOT NULL,
            endpoint_id INTEGER NOT NULL DEFAULT 1,
            cluster_id VARCHAR(16) NOT NULL,
            attribute_name VARCHAR(128) NOT NULL,
            CONSTRAINT uq_matter_cluster_attribute
                UNIQUE (device_type, endpoint_id, cluster_id, attribute_name)
        )
    """))

    from backend.utils.matter_catalog import iter_catalog_rows

    cluster_rows, attribute_rows = iter_catalog_rows()
    bind = op.get_bind()
    for row in cluster_rows:
        bind.execute(
            text("""
                INSERT INTO matter_device_clusters
                    (id, device_type, endpoint_id, cluster_id, cluster_name)
                VALUES
                    (:id, :device_type, :endpoint_id, :cluster_id, :cluster_name)
                ON CONFLICT ON CONSTRAINT uq_matter_device_cluster DO NOTHING
            """),
            {**row, "id": str(uuid.uuid4())},
        )
    for row in attribute_rows:
        bind.execute(
            text("""
                INSERT INTO matter_cluster_attributes
                    (id, device_type, endpoint_id, cluster_id, attribute_name)
                VALUES
                    (:id, :device_type, :endpoint_id, :cluster_id, :attribute_name)
                ON CONFLICT ON CONSTRAINT uq_matter_cluster_attribute DO NOTHING
            """),
            {**row, "id": str(uuid.uuid4())},
        )


def downgrade() -> None:
    # Local rollback only. Do not run this against production.
    op.execute(text("DROP TABLE IF EXISTS matter_cluster_attributes"))
    op.execute(text("DROP TABLE IF EXISTS matter_device_clusters"))
