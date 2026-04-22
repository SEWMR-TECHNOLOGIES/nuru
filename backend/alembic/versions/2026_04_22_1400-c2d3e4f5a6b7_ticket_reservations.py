"""add ticket reservation support to event_tickets

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-22 14:00:00.000000

Adds airline-style ticket reservations:
  - event_tickets.reserved_until  (nullable timestamp; non-null only for
    rows in the 'reserved' state)
  - 'reserved' value added to ticket_order_status_enum

Reservations:
  * Block inventory until they expire or are paid for.
  * Auto-deleted by /ticketing/reservations/sweep when reserved_until < now().
  * Convert to a normal pending order when the user begins payment.
"""
from alembic import op
import sqlalchemy as sa


revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New enum value — Postgres requires ALTER TYPE outside a transaction
    # block when adding values, but Alembic's online mode handles this for
    # IF NOT EXISTS in modern PG versions.
    op.execute("ALTER TYPE ticket_order_status_enum ADD VALUE IF NOT EXISTS 'reserved'")

    op.add_column(
        "event_tickets",
        sa.Column("reserved_until", sa.DateTime(timezone=False), nullable=True),
    )
    op.create_index(
        "ix_event_tickets_reserved_until",
        "event_tickets",
        ["reserved_until"],
        postgresql_where=sa.text("reserved_until IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_event_tickets_reserved_until", table_name="event_tickets")
    op.drop_column("event_tickets", "reserved_until")
    # Note: removing an enum value in Postgres requires recreating the type.
    # Down-migration leaves 'reserved' in place to avoid breaking referencing
    # rows; unused values are harmless.
