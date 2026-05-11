"""phase_14b_activity_completed_notif

Adds 'ACTIVITY_COMPLETED' to the notificationtype Postgres enum so the
backend can emit Notification(type=NotificationType.ACTIVITY_COMPLETED).

Revision ID: e5a1c0f3d27b
Revises: d92c7f4b8e15
Create Date: 2026-05-11 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e5a1c0f3d27b'
down_revision: Union[str, Sequence[str], None] = 'd92c7f4b8e15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ALTER TYPE ... ADD VALUE must run outside a transaction block in older
    # PG versions. PG 12+ tolerates it inside a transaction when IF NOT EXISTS
    # is supplied. Lightsail runs PG 15, so this is safe.
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'ACTIVITY_COMPLETED'")


def downgrade() -> None:
    """Downgrade schema.

    Postgres has no native DROP VALUE for enum types. Leaving the value in
    place on downgrade is the standard workaround and harmless.
    """
    pass
