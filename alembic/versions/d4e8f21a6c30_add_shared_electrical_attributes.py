"""Add electrical measurement attributes missing from device-type catalogs.

Revision ID: d4e8f21a6c30
Revises: c3a9e1b74d20
Create Date: 2026-10-15

Re-runs the idempotent catalog insert. Rows already stored are not updated.
"""
import uuid
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "d4e8f21a6c30"
down_revision: Union[str, None] = "c3a9e1b74d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    # Additive data only. Leaving the rows in place avoids deleting catalog data.
    pass
