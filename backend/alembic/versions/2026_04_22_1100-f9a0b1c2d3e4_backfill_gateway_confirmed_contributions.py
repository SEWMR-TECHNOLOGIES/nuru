"""backfill gateway-credited contributions and tickets

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-04-22 11:00:00.000000

Historic data fix. Before today, contributions and tickets that were paid
through the SasaPay gateway and successfully credited could still be
sitting in the 'pending' (awaiting organiser approval) pool because the
auto-confirm logic was added later. This migration:

  1) Flips every event_contribution whose transaction_ref matches a
     transaction in (paid, credited) status to confirmation_status =
     'confirmed' (and stamps confirmed_at if missing).
  2) Marks every event_ticket whose paid transaction is (paid, credited)
     as TicketOrderStatusEnum.confirmed so it appears in My Tickets and
     counts toward sold inventory.

Idempotent — only updates rows that are not already confirmed/cancelled.
"""
from alembic import op


revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Backfill contributions paid via gateway -> confirmed
    op.execute("""
        UPDATE event_contributions ec
        SET confirmation_status = 'confirmed',
            confirmed_at = COALESCE(ec.confirmed_at, NOW()),
            claim_reviewed_at = COALESCE(ec.claim_reviewed_at, NOW())
        FROM transactions t
        WHERE ec.transaction_ref IS NOT NULL
          AND ec.transaction_ref = t.transaction_code
          AND t.status IN ('paid', 'credited')
          AND ec.confirmation_status = 'pending';
    """)

    # 2. Backfill tickets paid via gateway -> confirmed
    op.execute("""
        UPDATE event_tickets et
        SET status = 'confirmed'
        FROM transactions t
        WHERE t.target_type = 'ticket'
          AND t.target_id = et.id
          AND t.status IN ('paid', 'credited')
          AND et.status NOT IN ('confirmed', 'approved', 'cancelled', 'rejected', 'refunded');
    """)


def downgrade() -> None:
    # Non-reversible data fix — confirmed money should not be put back
    # into the pending pool. No-op on downgrade.
    pass
