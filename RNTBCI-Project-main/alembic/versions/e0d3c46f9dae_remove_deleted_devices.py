"""Remove deleted devices

Revision ID: e0d3c46f9dae
Revises: 
Create Date: 2026-08-19 08:29:31.157321

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0d3c46f9dae'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('home_power_history', 'smart_tv_65_kw')
    op.drop_column('home_power_history', 'smart_tv_65_kvar')
    op.drop_column('home_power_history', 'nebulizer_kw')
    op.drop_column('home_power_history', 'nebulizer_kvar')
    op.drop_column('home_power_history', 'garage_door_kw')
    op.drop_column('home_power_history', 'garage_door_kvar')
    op.drop_column('home_power_history', 'garage_light_kw')
    op.drop_column('home_power_history', 'garage_light_kvar')
    op.drop_column('home_power_history', 'wifi_router_kw')
    op.drop_column('home_power_history', 'wifi_router_kvar')
    op.drop_column('home_power_history', 'induction_cooktop_kw')
    op.drop_column('home_power_history', 'induction_cooktop_kvar')


def downgrade() -> None:
    op.add_column('home_power_history', sa.Column('induction_cooktop_kvar', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('induction_cooktop_kw', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('wifi_router_kvar', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('wifi_router_kw', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('garage_light_kvar', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('garage_light_kw', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('garage_door_kvar', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('garage_door_kw', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('nebulizer_kvar', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('nebulizer_kw', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('smart_tv_65_kvar', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('home_power_history', sa.Column('smart_tv_65_kw', sa.Float(), nullable=False, server_default='0.0'))
