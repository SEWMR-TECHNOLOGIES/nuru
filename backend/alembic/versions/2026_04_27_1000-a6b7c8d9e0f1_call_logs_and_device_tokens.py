"""call_logs and device_tokens

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-04-27 10:00:00.000000

Adds two tables to power 1:1 voice/video calls:

* ``call_logs`` — one row per call, scoped to a conversation. Tracks the
  caller, callee, room name, lifecycle timestamps (``started_at``,
  ``answered_at``, ``ended_at``), final status (``ringing`` / ``ongoing`` /
  ``answered`` / ``missed`` / ``declined`` / ``ended`` / ``failed``), call
  kind (``voice`` / ``video``) and computed duration in seconds. Used by the
  chat to render WhatsApp-style call bubbles ("Missed call", "Outgoing call ·
  2:14", etc.) and by the polling signaling endpoint to surface incoming
  ringing calls to the callee.

* ``device_tokens`` — one row per (user, platform, token). Stores FCM/APNs
  push tokens used for VoIP push so calls ring the lock screen via CallKit
  (iOS) and the Android equivalent. Unique on (platform, token) so the same
  device can't be double-registered, and queryable by user_id for fan-out.

All idempotent — guarded so it can re-run on environments where these were
introduced out-of-band.
"""
from alembic import op
import sqlalchemy as sa


revision = "a6b7c8d9e0f1"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def _has_table(bind, table: str) -> bool:
    insp = sa.inspect(bind)
    return table in insp.get_table_names()


def _has_index(bind, table: str, index: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return any(i["name"] == index for i in insp.get_indexes(table))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    # ── call_logs ──────────────────────────────────────────────────────
    if not _has_table(bind, "call_logs"):
        op.create_table(
            "call_logs",
            sa.Column(
                "id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "conversation_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("conversations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "caller_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "callee_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("room_name", sa.Text(), nullable=False, unique=True),
            sa.Column("kind", sa.Text(), nullable=False, server_default="voice"),
            sa.Column("status", sa.Text(), nullable=False, server_default="ringing"),
            sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.Column("answered_at", sa.DateTime(), nullable=True),
            sa.Column("ended_at", sa.DateTime(), nullable=True),
            sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("end_reason", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        )

    # Indexes for the hot paths: incoming-poll and conversation history.
    if not _has_index(bind, "call_logs", "idx_call_logs_callee_status"):
        op.create_index("idx_call_logs_callee_status", "call_logs", ["callee_id", "status"])
    if not _has_index(bind, "call_logs", "idx_call_logs_conv_started"):
        op.create_index("idx_call_logs_conv_started", "call_logs", ["conversation_id", "started_at"])
    if not _has_index(bind, "call_logs", "idx_call_logs_caller"):
        op.create_index("idx_call_logs_caller", "call_logs", ["caller_id"])

    # ── device_tokens ─────────────────────────────────────────────────
    if not _has_table(bind, "device_tokens"):
        op.create_table(
            "device_tokens",
            sa.Column(
                "id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "user_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("platform", sa.Text(), nullable=False),  # 'ios' | 'android'
            sa.Column("token", sa.Text(), nullable=False),
            # 'voip' for iOS PushKit / 'fcm' for Android FCM data messages
            sa.Column("kind", sa.Text(), nullable=False, server_default="fcm"),
            sa.Column("app_version", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("platform", "token", name="uq_device_tokens_platform_token"),
        )
    if not _has_index(bind, "device_tokens", "idx_device_tokens_user"):
        op.create_index("idx_device_tokens_user", "device_tokens", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "device_tokens"):
        op.drop_table("device_tokens")
    if _has_table(bind, "call_logs"):
        op.drop_table("call_logs")
