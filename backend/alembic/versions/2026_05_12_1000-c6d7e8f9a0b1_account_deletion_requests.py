"""account_deletion_requests

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-05-12 10:00:00
"""
from typing import Sequence, Union
from alembic import op

revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        full_name text NOT NULL,
        email text NOT NULL,
        phone text NULL,
        reason text NULL,
        delete_scope text NOT NULL DEFAULT 'account_and_data',
        source text NULL,
        user_agent text NULL,
        ip_address varchar(64) NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        admin_notes text NULL,
        handled_by_admin_id uuid NULL REFERENCES admin_users(id) ON DELETE SET NULL,
        completed_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_account_deletion_requests_status ON account_deletion_requests(status);
    CREATE INDEX IF NOT EXISTS ix_account_deletion_requests_created ON account_deletion_requests(created_at);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS account_deletion_requests;")