"""Member import jobs + prepared-card status reuse

Two related schema changes for the "improved missing-member registration"
feature work:

1.  ``member_import_jobs`` — background-worker job table for bulk Committee
    and Guest member uploads. Mirrors ``contributor_import_jobs``.

2.  Reuse of ``sent_event_cards.delivery_status`` to track the new
    "prepared" state (rendered + uploaded but not yet sent). No new table:
    a prepared row has ``delivery_status='prepared'`` and ``sent_at IS
    NULL``; sending it transitions it to ``sent``/``failed`` exactly like
    today's direct dispatch. We add a partial index so the Prepared Cards
    listing stays fast.

Revision ID: cafe27052500
Revises: cafe27052400
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "cafe27052500"
down_revision = "cafe27052400"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "member_import_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False, server_default="guests"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("notify_sms", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("successful_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reused_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("invalid_phone_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("errors", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "idx_member_import_jobs_event_created",
        "member_import_jobs",
        ["event_id", "created_at"],
    )

    # Fast lookup for the Prepared Cards listing — rows where the organiser
    # rendered + uploaded the card but hasn't sent it yet.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_sent_event_cards_prepared "
        "ON sent_event_cards (event_id, event_card_id, created_at DESC) "
        "WHERE delivery_status = 'prepared' AND sent_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_sent_event_cards_prepared")
    op.drop_index("idx_member_import_jobs_event_created", table_name="member_import_jobs")
    op.drop_table("member_import_jobs")
