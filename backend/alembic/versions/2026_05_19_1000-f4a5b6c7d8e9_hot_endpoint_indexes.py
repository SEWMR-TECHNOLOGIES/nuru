"""hot endpoint indexes for /meetings/my, /user-events/*, /payments/pending

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-19 10:00:00

Targets the slow endpoints surfaced in production gunicorn logs:

  - /meetings/my                 -> event_meeting_participants(user_id),
                                    event_meetings ordering
  - /user-events/invited         -> event_invitations(invited_user_id, created_at),
                                    event_attendees(attendee_id, created_at)
  - /user-events/committee       -> event_committee_members(user_id, created_at)
  - /user-events/{id}            -> event_attendees(event_id, rsvp_status, updated_at),
                                    event_tickets(event_id, status)
  - /payments/pending            -> transactions(payer_user_id, status, created_at)

All statements are IF NOT EXISTS so the migration is safe to re-run.
"""
from alembic import op


revision = "f4a5b6c7d8e9"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


INDEXES = [
    # /meetings/my
    ("idx_emp_user", "event_meeting_participants", "(user_id)"),
    ("idx_em_scheduled_at_desc", "event_meetings", "(scheduled_at DESC)"),

    # /user-events/invited
    ("idx_ei_invited_user_created", "event_invitations", "(invited_user_id, created_at DESC)"),
    ("idx_ea_attendee_created", "event_attendees", "(attendee_id, created_at DESC)"),

    # /user-events/committee
    ("idx_ecm_user_created", "event_committee_members", "(user_id, created_at DESC)"),

    # /user-events/{id} essential extras
    ("idx_ea_event_rsvp_updated", "event_attendees", "(event_id, rsvp_status, updated_at DESC)"),
    ("idx_et_event_status", "event_tickets", "(event_id, status)"),

    # /payments/pending
    ("idx_tx_payer_status_created", "transactions", "(payer_user_id, status, created_at)"),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    op.execute("ANALYZE")


def downgrade() -> None:
    for name, _, _ in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
