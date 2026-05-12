"""phase_15_reports_feedback_bans

Phase 15 adds:
  - user.is_banned / banned_at / ban_reason
  - activity.submission_status (review pipeline state)
  - notificationtype enum values ACTIVITY_FEEDBACK, ADMIN_WARNING
  - activity_feedback table (admin -> creator notes per activity)
  - reportstatus enum
  - activity_report table
  - user_report table

Revision ID: f72b8c1a9d40
Revises: e5a1c0f3d27b
Create Date: 2026-05-12 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f72b8c1a9d40'
down_revision: Union[str, Sequence[str], None] = 'e5a1c0f3d27b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- User moderation columns ---------------------------------------
    op.add_column('user', sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('user', sa.Column('banned_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('user', sa.Column('ban_reason', sa.Text(), nullable=True))

    # --- Activity submission pipeline ----------------------------------
    op.add_column('activity', sa.Column('submission_status', sa.String(), nullable=True))

    # --- Notification enum: new values ---------------------------------
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'ACTIVITY_FEEDBACK'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'ADMIN_WARNING'")

    # --- Report status enum --------------------------------------------
    report_status_enum = postgresql.ENUM(
        'PENDING', 'WARNED', 'RESOLVED', 'DISMISSED',
        name='reportstatus',
        create_type=False,
    )
    report_status_enum.create(op.get_bind(), checkfirst=True)

    # --- activity_feedback table ---------------------------------------
    op.create_table(
        'activity_feedback',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('activity_id', sa.Integer(), sa.ForeignKey('activity.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('admin_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- activity_report table -----------------------------------------
    op.create_table(
        'activity_report',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('activity_id', sa.Integer(), sa.ForeignKey('activity.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', report_status_enum, nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
    )

    # --- user_report table ---------------------------------------------
    op.create_table(
        'user_report',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('reported_user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False, index=True),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', report_status_enum, nullable=False, server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('user_report')
    op.drop_table('activity_report')
    op.drop_table('activity_feedback')

    bind = op.get_bind()
    postgresql.ENUM(name='reportstatus').drop(bind, checkfirst=True)

    op.drop_column('activity', 'submission_status')
    op.drop_column('user', 'ban_reason')
    op.drop_column('user', 'banned_at')
    op.drop_column('user', 'is_banned')
    # NOTE: Postgres has no DROP VALUE for an enum type, so the new
    # notificationtype values stay in place on downgrade.
