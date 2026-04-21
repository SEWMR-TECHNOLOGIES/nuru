"""contact_messages table for public landing-page contact form

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-04-21 14:00:00.000000

Idempotent (IF NOT EXISTS).
"""
from alembic import op


revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS contact_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            subject TEXT,
            message TEXT NOT NULL,
            source_page TEXT,
            source_host TEXT,
            user_agent TEXT,
            ip_address VARCHAR(64),
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            is_archived BOOLEAN NOT NULL DEFAULT false,
            handled_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
            admin_notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_contact_messages_created ON contact_messages (created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contact_messages_status ON contact_messages (status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contact_messages")
