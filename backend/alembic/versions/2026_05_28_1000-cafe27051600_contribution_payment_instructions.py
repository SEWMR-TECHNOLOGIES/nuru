"""Add contribution_payment_instructions to events

Adds an optional free-text field used when notifying contributors about
contribution targets (SMS + WhatsApp). Falls back to a language-specific
default when NULL.

Revision ID: cafe27051600
Revises: cafe27051500
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27051600"
down_revision = "cafe27051500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("contribution_payment_instructions", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("events", "contribution_payment_instructions")
