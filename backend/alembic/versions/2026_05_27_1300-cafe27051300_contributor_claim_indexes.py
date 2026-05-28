"""contributor claim functional index on phone last9 + email lower

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-27 13:00:00.000000

The contributor-claim service (services/contributor_claim.py) runs on every
signup and every login. Without these indexes the UPDATE scans the entire
`user_contributors` table for each auth event.
"""
from alembic import op


revision = "cafe27051300"
down_revision = "cafe27051200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_contributors_phone_last9
        ON user_contributors (
            (RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9))
        )
        WHERE phone IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_contributors_email_lower
        ON user_contributors ((LOWER(email)))
        WHERE email IS NOT NULL
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_contributors_contributor_user_id "
        "ON user_contributors (contributor_user_id)"
    )
    op.execute("ANALYZE user_contributors")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_user_contributors_phone_last9")
    op.execute("DROP INDEX IF EXISTS idx_user_contributors_email_lower")
    # idx_user_contributors_contributor_user_id may already exist from the
    # 2026_04_19 migration — leave it in place on downgrade.
