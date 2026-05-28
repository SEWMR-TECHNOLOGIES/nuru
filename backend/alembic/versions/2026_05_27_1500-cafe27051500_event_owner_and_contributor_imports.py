"""Event owner separation + contributor import jobs

- Adds `event_owner_user_id` and `recognizable_event_owner_name` to events.
- Backfills `event_owner_user_id` from `organizer_id` for existing rows.
- Creates `contributor_import_jobs` table for background bulk uploads.

Revision ID: cafe27051500
Revises: cafe27051400
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "cafe27051500"
down_revision = "cafe27051400"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── events ────────────────────────────────────────────────────────────
    op.add_column(
        "events",
        sa.Column("event_owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("recognizable_event_owner_name", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "events_event_owner_user_id_fkey",
        "events",
        "users",
        ["event_owner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Backfill: existing events — owner = current organizer (creator).
    op.execute(
        "UPDATE events SET event_owner_user_id = organizer_id "
        "WHERE event_owner_user_id IS NULL AND organizer_id IS NOT NULL"
    )
    op.create_index(
        "idx_events_event_owner_user_id",
        "events",
        ["event_owner_user_id"],
    )

    # ── contributor_import_jobs ───────────────────────────────────────────
    op.create_table(
        "contributor_import_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("mode", sa.String(length=32), nullable=False, server_default="targets"),
        sa.Column("payment_method", sa.String(length=64), nullable=True),
        sa.Column("send_sms", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("successful_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "errors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "idx_contributor_import_jobs_event_created",
        "contributor_import_jobs",
        ["event_id", "created_at"],
    )
    op.create_index(
        "idx_contributor_import_jobs_status",
        "contributor_import_jobs",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("idx_contributor_import_jobs_status", table_name="contributor_import_jobs")
    op.drop_index(
        "idx_contributor_import_jobs_event_created",
        table_name="contributor_import_jobs",
    )
    op.drop_table("contributor_import_jobs")

    op.drop_index("idx_events_event_owner_user_id", table_name="events")
    op.drop_constraint("events_event_owner_user_id_fkey", "events", type_="foreignkey")
    op.drop_column("events", "recognizable_event_owner_name")
    op.drop_column("events", "event_owner_user_id")
