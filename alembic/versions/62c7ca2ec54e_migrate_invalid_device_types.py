"""migrate_invalid_device_types

Revision ID: 62c7ca2ec54e
Revises: e0d3c46f9dae
Create Date: 2026-08-19 18:01:50.672957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '62c7ca2ec54e'
down_revision: Union[str, None] = 'e0d3c46f9dae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update invalid legacy device types to SMART_PLUG.
    # The database string used for Enum is its property name, e.g. 'SMART_PLUG'.
    op.execute(
        "UPDATE devices SET type = 'SMART_PLUG' "
        "WHERE type IN ('COOKING', 'cooking', 'SMART_TV', 'smart_tv', 'ROUTER', 'router')"
    )


def downgrade() -> None:
    # Data migration downgrade is inherently lossy as we cannot know which SMART_PLUGs
    # were originally COOKING, SMART_TV, or ROUTER.
    pass
