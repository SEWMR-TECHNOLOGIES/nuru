"""Add text value to legacy moment_content_type enum

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
Create Date: 2026-05-03 11:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e0f1a2b3c4d5"
down_revision: Union[str, None] = "d9e0f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    legacy_exists = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moment_content_type')"
    )).scalar()
    enum_exists = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moment_content_type_enum')"
    )).scalar()
    with op.get_context().autocommit_block():
        if legacy_exists:
            op.execute("ALTER TYPE moment_content_type ADD VALUE IF NOT EXISTS 'text'")
        if enum_exists:
            op.execute("ALTER TYPE moment_content_type_enum ADD VALUE IF NOT EXISTS 'text'")


def downgrade() -> None:
    pass