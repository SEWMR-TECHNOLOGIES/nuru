"""Add 'maybe' value to rsvp_status for WhatsApp quick-reply RSVP.

Revision ID: cafe27052900
Revises: cafe27052800
"""
from alembic import op


revision = "cafe27052900"
down_revision = "cafe27052800"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres: ADD VALUE is idempotent via IF NOT EXISTS.
    # Actual enum name in the database is rsvp_status, not rsvp_status_enum.
    op.execute("ALTER TYPE rsvp_status ADD VALUE IF NOT EXISTS 'maybe'")


def downgrade() -> None:
    # Enum value removal is non-trivial in Postgres; no-op on downgrade.
    pass