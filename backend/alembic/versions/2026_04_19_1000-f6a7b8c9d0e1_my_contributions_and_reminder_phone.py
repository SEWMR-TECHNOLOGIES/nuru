"""add contributor_user_id and reminder_contact_phone

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-19 10:00:00.000000

Adds:
  1. user_contributors.contributor_user_id  (nullable FK -> users.id)
     Lets registered Nuru users see all events where they are listed as a
     contributor under "My Contributions" and self-pay.
  2. events.reminder_contact_phone  (nullable text)
     Optional fallback contact number used in reminder messages; defaults
     to organiser phone when NULL.
Also backfills contributor_user_id by matching the last 9 digits of phone.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. user_contributors.contributor_user_id
    op.add_column(
        "user_contributors",
        sa.Column("contributor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_user_contributors_contributor_user_id_users",
        "user_contributors", "users",
        ["contributor_user_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_user_contributors_contributor_user_id",
        "user_contributors", ["contributor_user_id"],
    )

    # Backfill: link contributor rows to users by matching last 9 phone digits.
    op.execute("""
        UPDATE user_contributors uc
        SET contributor_user_id = u.id
        FROM users u
        WHERE uc.contributor_user_id IS NULL
          AND uc.phone IS NOT NULL
          AND u.phone IS NOT NULL
          AND RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 9)
            = RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9);
    """)

    # 2. events.reminder_contact_phone
    op.add_column(
        "events",
        sa.Column("reminder_contact_phone", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("events", "reminder_contact_phone")
    op.drop_index("idx_user_contributors_contributor_user_id", table_name="user_contributors")
    op.drop_constraint(
        "fk_user_contributors_contributor_user_id_users",
        "user_contributors", type_="foreignkey",
    )
    op.drop_column("user_contributors", "contributor_user_id")
