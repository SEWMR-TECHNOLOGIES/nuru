"""Add partial index for incoming ringing-call lookup.

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
Create Date: 2026-05-03 12:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e0f1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial index: only ringing rows. Drastically cuts the
    # `/calls/incoming` poll cost (was ~400ms full scan).
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_call_logs_callee_ringing "
        "ON call_logs (callee_id, started_at DESC) "
        "WHERE status = 'ringing'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_call_logs_callee_ringing")
