"""WhatsApp message media url

Add ``media_url`` to ``wa_messages`` so the admin WhatsApp inbox can render
images sent through Meta template messages (e.g. invitation/thank-you
cards) the same way the consumer WhatsApp app does.

Revision ID: cafe27052700
Revises: cafe27052600
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27052700"
down_revision = "cafe27052600"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wa_messages",
        sa.Column("media_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "wa_messages",
        sa.Column("media_type", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("wa_messages", "media_type")
    op.drop_column("wa_messages", "media_url")
