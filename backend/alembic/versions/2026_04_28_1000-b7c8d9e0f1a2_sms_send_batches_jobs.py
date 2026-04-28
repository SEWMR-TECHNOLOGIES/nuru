"""sms_send_batches and sms_send_jobs

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-04-28 10:00:00.000000

Backs the new async + idempotent bulk SMS reminder pipeline.

* ``sms_send_batches`` — one row per organiser-initiated bulk send. Stores
  the original template, the dedup/idempotency hash and the lifecycle
  status. A repeat POST with the same ``(event_id, idempotency_hash)`` in
  the last hour returns the existing batch instead of duplicating sends.

* ``sms_send_jobs`` — one row per (batch, recipient). The unique constraint
  on ``(batch_id, recipient_phone_e164)`` is the hard idempotency guard:
  retries can only ever create new attempts on existing rows, never new
  rows for already-targeted phones. The worker only sends when status is
  still ``queued``; on success it flips to ``sent``, on failure it bumps
  ``attempts`` and schedules ``next_retry_at`` one hour out (capped at 3).

Both tables are guarded so the migration is safe to re-run.
"""
from alembic import op
import sqlalchemy as sa


revision = "b7c8d9e0f1a2"
down_revision = "a6b7c8d9e0f1"
branch_labels = None
depends_on = None


def _has_table(bind, table: str) -> bool:
    return table in sa.inspect(bind).get_table_names()


def _has_index(bind, table: str, index: str) -> bool:
    try:
        return any(i["name"] == index for i in sa.inspect(bind).get_indexes(table))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "sms_send_batches"):
        op.create_table(
            "sms_send_batches",
            sa.Column(
                "id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "event_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("events.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_by",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("message_template", sa.Text(), nullable=False),
            sa.Column("payment_info", sa.Text(), nullable=True),
            sa.Column("contact_phone", sa.Text(), nullable=True),
            sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "status",
                sa.String(length=16),
                nullable=False,
                server_default="queued",
            ),  # queued | running | done | partial
            sa.Column("idempotency_hash", sa.String(length=64), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
        )
    if not _has_index(bind, "sms_send_batches", "ix_sms_send_batches_idem"):
        op.create_index(
            "ix_sms_send_batches_idem",
            "sms_send_batches",
            ["event_id", "idempotency_hash", "created_at"],
        )

    if not _has_table(bind, "sms_send_jobs"):
        op.create_table(
            "sms_send_jobs",
            sa.Column(
                "id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "batch_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("sms_send_batches.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "event_contributor_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
            sa.Column("recipient_phone_e164", sa.String(length=20), nullable=False),
            sa.Column("recipient_name", sa.Text(), nullable=True),
            sa.Column("resolved_message", sa.Text(), nullable=False),
            sa.Column(
                "status",
                sa.String(length=16),
                nullable=False,
                server_default="queued",
            ),  # queued | sent | failed | skipped
            sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("next_retry_at", sa.DateTime(), nullable=True),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("error_text", sa.Text(), nullable=True),
            sa.UniqueConstraint(
                "batch_id",
                "recipient_phone_e164",
                name="uq_sms_send_jobs_batch_phone",
            ),
        )
    if not _has_index(bind, "sms_send_jobs", "ix_sms_send_jobs_status_retry"):
        op.create_index(
            "ix_sms_send_jobs_status_retry",
            "sms_send_jobs",
            ["status", "next_retry_at"],
        )
    if not _has_index(bind, "sms_send_jobs", "ix_sms_send_jobs_batch"):
        op.create_index("ix_sms_send_jobs_batch", "sms_send_jobs", ["batch_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "sms_send_jobs"):
        op.drop_table("sms_send_jobs")
    if _has_table(bind, "sms_send_batches"):
        op.drop_table("sms_send_batches")
