"""Enrich wa_message_logs with event/purpose tracking, fallback channel
and soft-delete fields.

Revision ID: cafe27053500
Revises: cafe27053400
Create Date: 2026-06-12 15:00:00

Adds the fields required to answer event-centric questions in the
WhatsApp Logs UI (which event, which recipient, what purpose, did
SMS fallback fire) without breaking any existing rows.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "cafe27053500"
down_revision: Union[str, None] = "cafe27053400"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_COLS = [
    # Event linkage snapshots
    ("event_name_snapshot", sa.String(length=255), True),
    # Recipient richer tagging
    ("recipient_type", sa.String(length=32), True),          # guest | contributor | committee | vendor | user | external
    ("recipient_id", postgresql.UUID(as_uuid=True), True),
    # Why this message was sent
    ("message_purpose", sa.String(length=128), True),        # e.g. invitation_card, rsvp_reminder, thank_you_card
    ("source_module", sa.String(length=64), True),           # e.g. event_cards, contributions, meetings
    # Related domain entity (booking, ticket, contribution row, …)
    ("related_entity_type", sa.String(length=64), True),
    ("related_entity_id", postgresql.UUID(as_uuid=True), True),
    # WhatsApp availability tri-state (nullable until we know)
    ("whatsapp_available", sa.Boolean(), True),
    # Richer failure capture
    ("error_title", sa.String(length=255), True),
    ("error_details", postgresql.JSONB, True),
    ("fbtrace_id", sa.String(length=128), True),
    ("last_status_at", sa.DateTime(timezone=True), True),
    # SMS / fallback channel visibility
    ("fallback_channel", sa.String(length=32), True),        # sms | email | push | none
    ("fallback_attempted", sa.Boolean(), True),
    ("fallback_status", sa.String(length=32), True),         # queued | sent | delivered | failed
    ("fallback_provider", sa.String(length=64), True),
    ("fallback_message_id", sa.String(length=255), True),
    ("fallback_error", sa.Text(), True),
    ("fallback_sent_at", sa.DateTime(timezone=True), True),
    # Soft delete
    ("deleted_at", sa.DateTime(timezone=True), True),
    ("deleted_by_user_id", postgresql.UUID(as_uuid=True), True),
]


def upgrade() -> None:
    with op.batch_alter_table("wa_message_logs") as batch:
        for name, col_type, nullable in _NEW_COLS:
            batch.add_column(sa.Column(name, col_type, nullable=nullable))

    # Defaults for booleans so existing rows don't break boolean filters
    op.execute("UPDATE wa_message_logs SET fallback_attempted = false WHERE fallback_attempted IS NULL")

    # Indexes for the filters the UI exposes
    op.create_index("ix_wa_message_logs_message_purpose",
                    "wa_message_logs", ["message_purpose"])
    op.create_index("ix_wa_message_logs_source_module",
                    "wa_message_logs", ["source_module"])
    op.create_index("ix_wa_message_logs_recipient_type",
                    "wa_message_logs", ["recipient_type"])
    op.create_index("ix_wa_message_logs_recipient_id",
                    "wa_message_logs", ["recipient_id"])
    op.create_index("ix_wa_message_logs_related_entity",
                    "wa_message_logs", ["related_entity_type", "related_entity_id"])
    op.create_index("ix_wa_message_logs_whatsapp_available",
                    "wa_message_logs", ["whatsapp_available"])
    op.create_index("ix_wa_message_logs_fallback_status",
                    "wa_message_logs", ["fallback_status"])
    op.create_index("ix_wa_message_logs_deleted_at",
                    "wa_message_logs", ["deleted_at"])
    # Composite hot path: event timeline view
    op.create_index("ix_wa_message_logs_event_created",
                    "wa_message_logs",
                    ["event_id", sa.text("created_at DESC")])


def downgrade() -> None:
    for ix in (
        "ix_wa_message_logs_event_created",
        "ix_wa_message_logs_deleted_at",
        "ix_wa_message_logs_fallback_status",
        "ix_wa_message_logs_whatsapp_available",
        "ix_wa_message_logs_related_entity",
        "ix_wa_message_logs_recipient_id",
        "ix_wa_message_logs_recipient_type",
        "ix_wa_message_logs_source_module",
        "ix_wa_message_logs_message_purpose",
    ):
        try:
            op.drop_index(ix, table_name="wa_message_logs")
        except Exception:  # noqa: BLE001
            pass

    with op.batch_alter_table("wa_message_logs") as batch:
        for name, _t, _n in reversed(_NEW_COLS):
            batch.drop_column(name)
