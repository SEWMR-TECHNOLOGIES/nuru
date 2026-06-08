"""Guest common name

Add an optional ``common_name`` to ``event_attendees``. The common name is a
human-friendly display label organisers can use on invitation cards (e.g.
"Mr & Mrs Mpinzile") that may differ from the guest's legal full name. When
present it takes precedence over the resolved full name for card rendering;
all other guest UX continues to use the legal name as the primary label.

Revision ID: cafe27052400
Revises: cafe27052300
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27052400"
down_revision = "cafe27052300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "event_attendees",
        sa.Column("common_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("event_attendees", "common_name")
