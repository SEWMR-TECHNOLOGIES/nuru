"""Create wa_message_logs table for transparent WhatsApp message tracking.

Revision ID: cafe27053300
Revises: cafe27053200
Create Date: 2026-06-12 13:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "cafe27053300"
down_revision: Union[str, None] = "cafe27053200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wa_message_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("recipient_phone", sa.String(length=32), nullable=False),
        sa.Column("normalized_phone", sa.String(length=32), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category", sa.String(length=64), nullable=False, server_default="template"),
        sa.Column("action", sa.String(length=128), nullable=True),
        sa.Column("template_name", sa.String(length=128), nullable=True),
        sa.Column("message_type", sa.String(length=32), nullable=False, server_default="template"),
        sa.Column("language", sa.String(length=8), nullable=True),
        sa.Column("direction", sa.String(length=16), nullable=False, server_default="outbound"),
        sa.Column("request_payload", postgresql.JSONB, nullable=True),
        sa.Column("response_payload", postgresql.JSONB, nullable=True),
        sa.Column("webhook_payload", postgresql.JSONB, nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("media_url", sa.Text(), nullable=True),
        sa.Column("media_type", sa.String(length=32), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="whatsapp_cloud_api"),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parent_log_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("wa_message_logs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("queued_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_wa_message_logs_recipient_phone",
                    "wa_message_logs", ["recipient_phone"])
    op.create_index("ix_wa_message_logs_normalized_phone",
                    "wa_message_logs", ["normalized_phone"])
    op.create_index("ix_wa_message_logs_user_id",
                    "wa_message_logs", ["user_id"])
    op.create_index("ix_wa_message_logs_event_id",
                    "wa_message_logs", ["event_id"])
    op.create_index("ix_wa_message_logs_category",
                    "wa_message_logs", ["category"])
    op.create_index("ix_wa_message_logs_action",
                    "wa_message_logs", ["action"])
    op.create_index("ix_wa_message_logs_template_name",
                    "wa_message_logs", ["template_name"])
    op.create_index("ix_wa_message_logs_provider_message_id",
                    "wa_message_logs", ["provider_message_id"])
    op.create_index("ix_wa_message_logs_status",
                    "wa_message_logs", ["status"])
    op.create_index("ix_wa_message_logs_parent_log_id",
                    "wa_message_logs", ["parent_log_id"])
    op.create_index("ix_wa_message_logs_status_created",
                    "wa_message_logs",
                    ["status", sa.text("created_at DESC")])
    op.create_index("ix_wa_message_logs_category_created",
                    "wa_message_logs",
                    ["category", sa.text("created_at DESC")])


def downgrade() -> None:
    op.drop_index("ix_wa_message_logs_category_created", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_status_created", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_parent_log_id", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_status", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_provider_message_id", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_template_name", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_action", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_category", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_event_id", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_user_id", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_normalized_phone", table_name="wa_message_logs")
    op.drop_index("ix_wa_message_logs_recipient_phone", table_name="wa_message_logs")
    op.drop_table("wa_message_logs")
