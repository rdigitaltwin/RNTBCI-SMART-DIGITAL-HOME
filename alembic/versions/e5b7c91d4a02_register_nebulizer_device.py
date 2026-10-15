"""Register the Nebulizer device type and its device row.

Revision ID: e5b7c91d4a02
Revises: d4e8f21a6c30
Create Date: 2026-10-15

The Nebulizer previously existed only as a JSON file. This adds the
enum label and inserts one device using the file's existing UUID.
Existing rows are not updated.
"""
import uuid
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "e5b7c91d4a02"
down_revision: Union[str, None] = "d4e8f21a6c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEBULIZER_ID = "ed3367d0-60b2-480f-acbd-cf4a2000a865"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute(text("ALTER TYPE devicetype ADD VALUE IF NOT EXISTS 'NEBULIZER'"))
            op.execute(text("ALTER TYPE devicetype ADD VALUE IF NOT EXISTS 'nebulizer'"))

    op.execute(text("""
        INSERT INTO devices (
            id, name, type, room_id, status, power_state, connectivity,
            energy_usage_kw, total_energy_kwh, efficiency_percent,
            metadata, execution_mode, position_x, position_y, position_z,
            last_updated, created_at
        )
        SELECT
            CAST(:device_id AS uuid),
            'Nebulizer',
            'NEBULIZER',
            room.id,
            'ONLINE',
            'OFF',
            'CONNECTED',
            0,
            0,
            100,
            CAST(:metadata AS jsonb),
            'simulation',
            0, 0, 0,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM rooms AS room
        WHERE NOT EXISTS (
            SELECT 1 FROM devices
            WHERE id = CAST(:device_id AS uuid)
               OR name IN ('Nebulizer', 'Nebuliser')
        )
        ORDER BY CASE WHEN room.name ILIKE '%bath%' THEN 0 ELSE 1 END, room.name
        LIMIT 1
    """), {
        "device_id": NEBULIZER_ID,
        "metadata": '{"MistLevel": "Low", "session": "stopped", "rated_power": 0.04}',
    })

    from backend.utils.matter_catalog import iter_catalog_rows

    cluster_rows, attribute_rows = iter_catalog_rows()
    for row in cluster_rows:
        if row["device_type"] != "NEBULIZER":
            continue
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
        if row["device_type"] != "NEBULIZER":
            continue
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
    # Leave the device row and enum label in place.
    pass
