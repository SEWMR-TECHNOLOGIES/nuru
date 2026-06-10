"""Event what_to_expect content

Optional structured ``what_to_expect`` (JSONB list of {icon,label,description}
items) and free-form ``what_to_expect_notes`` (TEXT) on ``events``. Both
nullable; the mobile/web UI hides the section entirely when both are empty.

Revision ID: cafe27052800
Revises: cafe27052700
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "cafe27052800"
down_revision = "cafe27052700"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("what_to_expect", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("what_to_expect_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("events", "what_to_expect_notes")
    op.drop_column("events", "what_to_expect")
