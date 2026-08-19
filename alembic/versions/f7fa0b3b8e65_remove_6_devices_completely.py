"""remove_6_devices_completely

Revision ID: f7fa0b3b8e65
Revises: 62c7ca2ec54e
Create Date: 2026-08-19 18:46:14.045117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7fa0b3b8e65'
down_revision: Union[str, None] = '62c7ca2ec54e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Permanently delete the 6 legacy devices from the database.
    # Note: Because the type was changed in a prior migration for some of these devices to SMART_PLUG,
    # we need to delete by name explicitly if the type has already been mutated,
    # or by their original types just in case the previous migration wasn't run.
    op.execute(
        "DELETE FROM devices WHERE name IN ("
        "'Nebuliser', 'Nebulizer', 'WiFi Router', 'Router', "
        "'LED TV', 'Smart TV', 'Smart TV 65\"', 'Garage Light', 'Garage Door', 'Induction Cooktop'"
        ") OR type IN ("
        "'NEBULIZER', 'nebulizer', 'ROUTER', 'router', 'SMART_TV', 'smart_tv', "
        "'COOKING', 'cooking', 'GARAGE_DOOR', 'garage_door', 'GARAGE_LIGHT', 'garage_light', 'INDUCTION', 'induction'"
        ")"
    )

def downgrade() -> None:
    # Cannot restore deleted devices trivially
    pass
