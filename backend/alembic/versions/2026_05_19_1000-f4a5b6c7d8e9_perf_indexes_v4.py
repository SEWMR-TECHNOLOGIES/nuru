"""perf indexes v4 -- slow-endpoint pass

Revision ID: f4a5b6c7d8ea
Revises: f4a5b6c7d8e9
Create Date: 2026-05-19 10:00:00

Targets the May-2026 slow-endpoint audit:

  - /user-events/invited       -> event_invitations(invited_user_id), event_attendees(attendee_id, event_id)
  - /user-events/committee     -> event_committee_members(user_id, created_at DESC)
  - /ticketing/my-upcoming-tickets -> event_tickets(buyer_user_id, status, event_id)
  - /payments/pending          -> transactions(payer_user_id, status, created_at)
  - /meetings/my               -> event_meeting_participants(user_id, meeting_id)
  - /users/search?suggested    -> user_followers(following_id, follower_id)
  - /messages/                 -> conversations covering filter for both participant columns
  - /migration-status          -> wallets partial index for pending_balance > 0

All indexes are additive and IF NOT EXISTS guarded.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f4a5b6c7d8ea"
down_revision: Union[str, None] = "f4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_invitations_invited_user_created
        ON event_invitations (invited_user_id, created_at DESC)
        WHERE invited_user_id IS NOT NULL;
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_attendees_attendee_event
        ON event_attendees (attendee_id, event_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_committee_members_user_created
        ON event_committee_members (user_id, created_at DESC);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_tickets_buyer_status_event
        ON event_tickets (buyer_user_id, status, event_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_transactions_payer_status_created
        ON transactions (payer_user_id, status, created_at);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_event_meeting_participants_user_meeting
        ON event_meeting_participants (user_id, meeting_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_followers_following_follower
        ON user_followers (following_id, follower_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_conversations_user_one_active_updated
        ON conversations (user_one_id, is_active, updated_at DESC);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_conversations_user_two_active_updated
        ON conversations (user_two_id, is_active, updated_at DESC);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_wallets_user_pending
        ON wallets (user_id)
        WHERE pending_balance > 0;
        """
    )

    op.execute("ANALYZE;")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_wallets_user_pending;")
    op.execute("DROP INDEX IF EXISTS idx_conversations_user_two_active_updated;")
    op.execute("DROP INDEX IF EXISTS idx_conversations_user_one_active_updated;")
    op.execute("DROP INDEX IF EXISTS idx_user_followers_following_follower;")
    op.execute("DROP INDEX IF EXISTS idx_event_meeting_participants_user_meeting;")
    op.execute("DROP INDEX IF EXISTS idx_transactions_payer_status_created;")
    op.execute("DROP INDEX IF EXISTS idx_event_tickets_buyer_status_event;")
    op.execute("DROP INDEX IF EXISTS idx_event_committee_members_user_created;")
    op.execute("DROP INDEX IF EXISTS idx_event_attendees_attendee_event;")
    op.execute("DROP INDEX IF EXISTS idx_event_invitations_invited_user_created;")