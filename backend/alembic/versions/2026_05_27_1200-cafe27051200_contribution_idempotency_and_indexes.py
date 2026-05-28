"""contribution idempotency + hot indexes for record_payment

Revision ID: a7b8c9d0e1f2
Revises: f0d4e5b6c7a8
Create Date: 2026-05-27 12:00:00.000000

- Adds `contribution_idempotency` table so retries of POST
  /events/{event_id}/contributors/{ec_id}/payments with the same
  Idempotency-Key header don't double-record.
- Adds composite indexes that match the hot filters in
  `record_payment` + `confirm_contributions`.
"""
from alembic import op


revision = "cafe27051200"
down_revision = "f0d4e5b6c7a8"
branch_labels = None
depends_on = None


INDEXES = [
    # Hot filter: "all confirmed contributions for this contributor"
    ("idx_event_contributions_contributor_status",
     "event_contributions",
     "(event_contributor_id, confirmation_status)"),
    # Hot filter for committee dashboards: "what did this recorder enter recently?"
    ("idx_event_contributions_recorder_date",
     "event_contributions",
     "(recorded_by, contributed_at DESC)"),
]


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contribution_idempotency (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            idem_key      TEXT NOT NULL,
            user_id       UUID NOT NULL,
            scope         TEXT NOT NULL,
            response_id   UUID NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, scope, idem_key)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_contrib_idem_created "
        "ON contribution_idempotency (created_at)"
    )
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    op.execute("ANALYZE")


def downgrade() -> None:
    for name, _, _ in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
    op.execute("DROP TABLE IF EXISTS contribution_idempotency")
