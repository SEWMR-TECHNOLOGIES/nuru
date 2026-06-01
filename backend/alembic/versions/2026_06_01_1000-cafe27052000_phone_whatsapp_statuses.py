"""Create phone_whatsapp_statuses table

Stores per-normalized-phone WhatsApp availability so we don't poll Meta on
every page load. Backfill + actual provider checks run in Celery — this
migration only creates the schema.

Revision ID: cafe27052000
Revises: cafe27051900
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27052000"
down_revision = "cafe27051900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "phone_whatsapp_statuses",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("raw_phone", sa.Text(), nullable=True),
        sa.Column("normalized_phone", sa.Text(), nullable=False),
        sa.Column("country_code", sa.String(8), nullable=True),
        sa.Column("national_number", sa.Text(), nullable=True),
        sa.Column("normalization_status", sa.String(32), nullable=False,
                  server_default=sa.text("'ok'")),
        sa.Column("normalization_error", sa.Text(), nullable=True),
        sa.Column("is_whatsapp", sa.Boolean(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False,
                  server_default=sa.text("'unknown'")),
        sa.Column("provider", sa.String(64), nullable=False,
                  server_default=sa.text("'whatsapp_cloud_api'")),
        sa.Column("provider_response_code", sa.String(64), nullable=True),
        sa.Column("provider_error_code", sa.String(64), nullable=True),
        sa.Column("provider_error_message", sa.Text(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_check_after", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_attempts", sa.Integer(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_unique_constraint(
        "ux_phone_whatsapp_statuses_normalized_phone",
        "phone_whatsapp_statuses", ["normalized_phone"],
    )
    op.create_index(
        "ix_phone_whatsapp_statuses_status_next_check",
        "phone_whatsapp_statuses", ["status", "next_check_after"],
    )
    op.create_index(
        "ix_phone_whatsapp_statuses_last_checked",
        "phone_whatsapp_statuses", ["last_checked_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_phone_whatsapp_statuses_last_checked",
                  table_name="phone_whatsapp_statuses")
    op.drop_index("ix_phone_whatsapp_statuses_status_next_check",
                  table_name="phone_whatsapp_statuses")
    op.drop_constraint("ux_phone_whatsapp_statuses_normalized_phone",
                       "phone_whatsapp_statuses", type_="unique")
    op.drop_table("phone_whatsapp_statuses")
