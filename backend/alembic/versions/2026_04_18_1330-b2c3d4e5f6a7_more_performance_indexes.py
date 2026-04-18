"""more performance indexes: events, notifications, contributions, services

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-18 13:30:00.000000

Adds composite indexes declared in the SQLAlchemy models for:
  - events (organizer/status/start_date/public/ticket_approval/created)
  - notifications (recipient/created, recipient/is_read, reference)
  - event_contributions (event/contributed_at, contributor/contributed_at, recorder)
  - user_services (user/active/created, active/category, active/type, verified/active)
  - user_service_ratings (service/created, user)

All statements use IF NOT EXISTS so the migration is safe to re-run and
tolerant of indexes that may already exist out-of-band (see all db indexes.csv).
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


# (index_name, table, columns)
INDEXES = [
    # events
    ("idx_events_organizer_start", "events", "(organizer_id, start_date)"),
    ("idx_events_organizer_status", "events", "(organizer_id, status)"),
    ("idx_events_status_start", "events", "(status, start_date)"),
    ("idx_events_public_start", "events", "(is_public, start_date)"),
    ("idx_events_ticket_approval_status", "events", "(ticket_approval_status)"),
    ("idx_events_created_at", "events", "(created_at DESC)"),

    # notifications
    ("idx_notifications_recipient_created", "notifications", "(recipient_id, created_at DESC)"),
    ("idx_notifications_recipient_unread", "notifications", "(recipient_id, is_read)"),
    ("idx_notifications_reference", "notifications", "(reference_type, reference_id)"),

    # event_contributions
    ("idx_event_contributions_event_contributed", "event_contributions", "(event_id, contributed_at DESC)"),
    ("idx_event_contributions_contributor_date", "event_contributions", "(event_contributor_id, contributed_at DESC)"),
    ("idx_event_contributions_recorder", "event_contributions", "(recorded_by)"),

    # user_services
    ("idx_user_services_user_active_created", "user_services", "(user_id, is_active, created_at DESC)"),
    ("idx_user_services_active_category", "user_services", "(is_active, category_id)"),
    ("idx_user_services_active_type", "user_services", "(is_active, service_type_id)"),
    ("idx_user_services_verified_active", "user_services", "(is_verified, is_active)"),

    # user_service_ratings
    ("idx_user_service_ratings_service_created", "user_service_ratings", "(user_service_id, created_at DESC)"),
    ("idx_user_service_ratings_user", "user_service_ratings", "(user_id)"),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    op.execute("ANALYZE")


def downgrade() -> None:
    for name, _, _ in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
