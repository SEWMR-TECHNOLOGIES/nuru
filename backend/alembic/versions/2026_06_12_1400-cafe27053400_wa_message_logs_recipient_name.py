"""Add recipient_name column to wa_message_logs.

Revision ID: cafe27053400
Revises: cafe27053300
Create Date: 2026-06-12 14:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "cafe27053400"
down_revision: Union[str, None] = "cafe27053300"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "wa_message_logs",
        sa.Column("recipient_name", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_wa_message_logs_recipient_name",
        "wa_message_logs",
        ["recipient_name"],
    )


def downgrade() -> None:
    op.drop_index("ix_wa_message_logs_recipient_name", table_name="wa_message_logs")
    op.drop_column("wa_message_logs", "recipient_name")
