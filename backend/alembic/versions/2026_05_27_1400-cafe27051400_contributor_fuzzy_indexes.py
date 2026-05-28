"""contributor fuzzy claim indexes (phone last6 + email local-part)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-27 14:00:00.000000

The fuzzy pass in services/contributor_claim.py prefilters orphan rows by
last-6 phone OR email local-part before running Python-side name similarity.
Without these indexes the prefilter scans the full table on every login.
"""
from alembic import op


revision = "cafe27051400"
down_revision = "cafe27051300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_contributors_phone_last6
        ON user_contributors (
            (RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 6))
        )
        WHERE phone IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_contributors_email_local
        ON user_contributors ((LOWER(SPLIT_PART(email, '@', 1))))
        WHERE email IS NOT NULL
        """
    )
    op.execute("ANALYZE user_contributors")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_user_contributors_phone_last6")
    op.execute("DROP INDEX IF EXISTS idx_user_contributors_email_local")
