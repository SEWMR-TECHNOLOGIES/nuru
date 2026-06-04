"""Add edit metadata columns to event_group_messages

Adds is_edited / edited_at columns so chat messages can be edited
within a 15-minute window and surfaced with an "edited" label.

Revision ID: cafe27052100
Revises: cafe27052000
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27052100"
down_revision = "cafe27052000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "event_group_messages",
        sa.Column(
            "is_edited",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "event_group_messages",
        sa.Column("edited_at", sa.DateTime(timezone=False), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("event_group_messages", "edited_at")
    op.drop_column("event_group_messages", "is_edited")
