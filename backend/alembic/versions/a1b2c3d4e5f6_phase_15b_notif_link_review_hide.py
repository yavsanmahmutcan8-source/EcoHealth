"""phase_15b: notification.link + review soft-hide columns

Revision ID: a1b2c3d4e5f6
Revises: f72b8c1a9d40
Create Date: 2026-05-14 12:00:00

Adds:
  - notification.link: optional in-app destination for click-through
  - review.is_hidden / hidden_at / hidden_by_admin_id: soft-hide so the
    author still sees their moderated comment with a "removed" marker,
    but other users see it filtered out.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f72b8c1a9d40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Notification link
    op.add_column(
        "notification",
        sa.Column("link", sa.Text(), nullable=True),
    )

    # Review soft-hide
    op.add_column(
        "review",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "review",
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "review",
        sa.Column("hidden_by_admin_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_review_hidden_by_admin_id_user",
        "review",
        "user",
        ["hidden_by_admin_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_review_hidden_by_admin_id_user", "review", type_="foreignkey")
    op.drop_column("review", "hidden_by_admin_id")
    op.drop_column("review", "hidden_at")
    op.drop_column("review", "is_hidden")
    op.drop_column("notification", "link")
