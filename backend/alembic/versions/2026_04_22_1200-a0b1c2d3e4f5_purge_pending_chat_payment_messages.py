"""Soft-delete event group chat 'payment' system messages whose underlying
contribution is pending or rejected. Historical announcements that landed in
the chat before the approval gate was added must be hidden so members never
see contributions that may later be rejected.

Revision ID: a0b1c2d3e4f5
Revises: f9a0b1c2d3e4
Create Date: 2026-04-22 12:00:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "a0b1c2d3e4f5"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Strategy: a payment system message is identified by
    #   message_type = 'system' AND metadata_json->>'kind' = 'payment'.
    # The metadata stores contributor_name + amount but not a contribution_id,
    # so we match conservatively: hide payment system messages where, for the
    # owning event_group's event, there exists NO confirmed contribution by a
    # contributor of that name with that exact amount. Anything that cannot be
    # matched to a confirmed contribution is presumed pending/rejected and
    # gets soft-deleted (is_deleted = true).
    op.execute(
        """
        UPDATE event_group_messages m
           SET is_deleted = true
          FROM event_groups g
         WHERE m.group_id = g.id
           AND m.message_type = 'system'
           AND m.is_deleted = false
           AND (m.metadata_json ->> 'kind') = 'payment'
           AND NOT EXISTS (
                 SELECT 1
                   FROM event_contributions ec
                   JOIN event_contributors c ON c.id = ec.event_contributor_id
                  WHERE ec.event_id = g.event_id
                    AND ec.confirmation_status = 'confirmed'
                    AND ROUND(ec.amount::numeric)
                        = ROUND( (m.metadata_json ->> 'amount')::numeric )
                    AND (
                          (SELECT name FROM user_contributors uc
                            WHERE uc.id = c.contributor_id)
                          = (m.metadata_json ->> 'contributor_name')
                    )
           );
        """
    )


def downgrade() -> None:
    # No-op: we cannot reliably tell which messages we hid, and unhiding all
    # 'payment' system messages would re-expose pending entries we never want
    # to show. Restore from backup if needed.
    pass
