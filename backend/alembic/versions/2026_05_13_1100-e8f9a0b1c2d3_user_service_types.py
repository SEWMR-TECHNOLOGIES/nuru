"""user_service_types join table (multiple types per service)

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-05-13 11:00:00
"""
from typing import Sequence, Union
from alembic import op


revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_service_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_service_id UUID NOT NULL REFERENCES user_services(id) ON DELETE CASCADE,
            service_type_id UUID NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_user_service_type UNIQUE (user_service_id, service_type_id)
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_service_types_service ON user_service_types (user_service_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_service_types_type ON user_service_types (service_type_id);"
    )
    # Backfill: copy existing single service_type_id into the join table as primary
    op.execute(
        """
        INSERT INTO user_service_types (user_service_id, service_type_id, is_primary)
        SELECT us.id, us.service_type_id, TRUE
        FROM user_services us
        WHERE us.service_type_id IS NOT NULL
        ON CONFLICT (user_service_id, service_type_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_service_types;")
