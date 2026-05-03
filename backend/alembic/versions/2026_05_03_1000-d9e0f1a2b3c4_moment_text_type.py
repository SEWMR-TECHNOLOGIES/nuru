"""Add 'text' value to moment_content_type_enum

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-05-03 10:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "d9e0f1a2b3c4"
down_revision: Union[str, None] = "c8d9e0f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'text' value to existing enum (idempotent)
    op.execute("ALTER TYPE moment_content_type_enum ADD VALUE IF NOT EXISTS 'text'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values cleanly; no-op
    pass
