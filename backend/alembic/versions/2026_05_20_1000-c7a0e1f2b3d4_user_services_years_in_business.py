"""user_services: years_in_business

Revision ID: c7a0e1f2b3d4
Revises: a6b99eac885b
Create Date: 2026-05-20 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "c7a0e1f2b3d4"
down_revision = "a6b99eac885b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_services
            ADD COLUMN IF NOT EXISTS years_in_business INTEGER;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_services
            DROP COLUMN IF EXISTS years_in_business;
        """
    )
