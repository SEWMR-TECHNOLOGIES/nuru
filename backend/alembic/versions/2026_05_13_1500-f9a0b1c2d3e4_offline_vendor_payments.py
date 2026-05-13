"""offline vendor payments

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-05-13 15:00:00
"""
from typing import Sequence, Union
from alembic import op


revision: str = "e9f0a1b2c3d4"
down_revision: Union[str, None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS offline_vendor_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            event_service_id UUID NOT NULL REFERENCES event_services(id) ON DELETE CASCADE,
            vendor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
            amount NUMERIC(14,2) NOT NULL,
            currency TEXT NOT NULL DEFAULT 'TZS',
            method TEXT,
            reference TEXT,
            note TEXT,
            otp_code_hash TEXT NOT NULL,
            otp_expires_at TIMESTAMPTZ NOT NULL,
            otp_attempts INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            confirmed_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            expense_id UUID REFERENCES event_expenses(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_ovp_event ON offline_vendor_payments (event_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ovp_vendor ON offline_vendor_payments (vendor_user_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ovp_event_service ON offline_vendor_payments (event_service_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS offline_vendor_payments;")
