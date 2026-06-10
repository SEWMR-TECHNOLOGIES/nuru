"""Ensure WhatsApp status table exists and RSVP maybe enum is present.

Revision ID: cafe27053000
Revises: cafe27052900
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27053000"
down_revision = "cafe27052900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    enum_names = [
        row[0]
        for row in bind.execute(
            sa.text("select typname from pg_type where typname in ('rsvp_status', 'rsvp_status_enum')")
        ).all()
    ]
    for enum_name in enum_names:
        op.execute(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS 'maybe'")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS phone_whatsapp_statuses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            raw_phone text,
            normalized_phone text NOT NULL,
            country_code varchar(8),
            national_number text,
            normalization_status varchar(32) NOT NULL DEFAULT 'ok',
            normalization_error text,
            is_whatsapp boolean,
            status varchar(32) NOT NULL DEFAULT 'unknown',
            provider varchar(64) NOT NULL DEFAULT 'whatsapp_cloud_api',
            provider_response_code varchar(64),
            provider_error_code varchar(64),
            provider_error_message text,
            last_checked_at timestamptz,
            next_check_after timestamptz,
            check_attempts integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_phone_whatsapp_statuses_normalized_phone "
        "ON phone_whatsapp_statuses (normalized_phone)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_phone_whatsapp_statuses_status_next_check "
        "ON phone_whatsapp_statuses (status, next_check_after)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_phone_whatsapp_statuses_last_checked "
        "ON phone_whatsapp_statuses (last_checked_at)"
    )


def downgrade() -> None:
    # Keep table and enum value on downgrade to avoid data loss and because
    # Postgres enum value removal requires type recreation.
    pass