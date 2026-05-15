"""perf indexes v3

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-05-15 10:00:00

Notes
-----
All indexes below were verified against the live model definitions in
backend/app/models/* before being added:

- event_contributors:  event_id, contributor_id   (no `phone` column)
- user_contributors:   phone                      (phone lives here)
- event_expenses:      event_id, expense_date     (no `status` column)
- transactions:        external_reference, payer_user_id, created_at
                       (there is no `payments` table; payment data lives in
                        `transactions`, ref column is `external_reference`)
- event_attendees:     event_id, attendee_id, rsvp_status
- support_messages:    ticket_id, created_at      (no `conversation_id` column)
"""
from typing import Sequence, Union
from alembic import op


revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Contributors: list-by-event + dedupe-by-contributor
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_contributors_event_contrib
        ON event_contributors (event_id, contributor_id);
        """
    )
    # Phone lives on user_contributors, not event_contributors.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_contributors_phone
        ON user_contributors (phone)
        WHERE phone IS NOT NULL;
        """
    )

    # Expenses: list-by-event ordered by date (no status column on this table)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_expenses_event_date
        ON event_expenses (event_id, expense_date DESC);
        """
    )

    # Transactions (the real payments table): receipt lookup + per-user history
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_transactions_external_reference
        ON transactions (external_reference)
        WHERE external_reference IS NOT NULL;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_transactions_payer_created
        ON transactions (payer_user_id, created_at DESC);
        """
    )

    # Attendees: covering index for RSVP page lookup
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_attendees_event_attendee_status
        ON event_attendees (event_id, attendee_id, rsvp_status);
        """
    )

    # Support chat: paginated message scan (column is ticket_id, not conversation_id)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
        ON support_messages (ticket_id, created_at DESC);
        """
    )

    # Refresh planner stats
    op.execute("ANALYZE;")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_support_messages_ticket_created;")
    op.execute("DROP INDEX IF EXISTS idx_event_attendees_event_attendee_status;")
    op.execute("DROP INDEX IF EXISTS idx_transactions_payer_created;")
    op.execute("DROP INDEX IF EXISTS idx_transactions_external_reference;")
    op.execute("DROP INDEX IF EXISTS idx_event_expenses_event_date;")
    op.execute("DROP INDEX IF EXISTS idx_user_contributors_phone;")
    op.execute("DROP INDEX IF EXISTS idx_event_contributors_event_contrib;")
