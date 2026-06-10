"""Contributor common name

Add an optional ``common_name`` to ``user_contributors`` (the global address
book). Mirrors ``event_attendees.common_name`` so invitation cards can
render an organiser-supplied display label (e.g. "Mr & Mrs Mpinzile") for
contributors as well. Falls back to ``name`` when empty.

Revision ID: cafe27052600
Revises: cafe27052500
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27052600"
down_revision = "cafe27052500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_contributors",
        sa.Column("common_name", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_contributors", "common_name")
