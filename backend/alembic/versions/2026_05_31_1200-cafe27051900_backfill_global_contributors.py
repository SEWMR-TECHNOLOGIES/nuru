"""Backfill global address-book contributors from event contributors

Mirrors every EventContributor's linked UserContributor into the event
organiser's personal address book so they appear in Global Contributors.

De-dup: last 9 digits of phone when present, else lower(name). Idempotent.

Revision ID: cafe27051900
Revises: cafe27051800
"""
from alembic import op


revision = "cafe27051900"
down_revision = "cafe27051800"
branch_labels = None
depends_on = None


BACKFILL_SQL = """
INSERT INTO user_contributors (id, user_id, name, email, phone, notes, secondary_phone, notify_target, created_at, updated_at)
SELECT
    gen_random_uuid(),
    src.organizer_id,
    src.name,
    src.email,
    src.phone,
    src.notes,
    src.secondary_phone,
    COALESCE(src.notify_target, 'primary'),
    now(),
    now()
FROM (
    SELECT DISTINCT ON (
        e.organizer_id,
        COALESCE(
            NULLIF(RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 9), ''),
            'name:' || LOWER(uc.name)
        )
    )
        e.organizer_id,
        uc.name,
        uc.email,
        uc.phone,
        uc.notes,
        uc.secondary_phone,
        uc.notify_target
    FROM event_contributors ec
    JOIN events e ON e.id = ec.event_id
    JOIN user_contributors uc ON uc.id = ec.contributor_id
    WHERE e.organizer_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM user_contributors uc2
          WHERE uc2.user_id = e.organizer_id
            AND (
                (uc.phone IS NOT NULL
                 AND uc2.phone IS NOT NULL
                 AND RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 9)
                   = RIGHT(REGEXP_REPLACE(uc2.phone, '[^0-9]', '', 'g'), 9))
                OR
                ((uc.phone IS NULL OR uc.phone = '')
                 AND (uc2.phone IS NULL OR uc2.phone = '')
                 AND LOWER(uc.name) = LOWER(uc2.name))
            )
      )
    ORDER BY
        e.organizer_id,
        COALESCE(
            NULLIF(RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 9), ''),
            'name:' || LOWER(uc.name)
        ),
        uc.created_at ASC
) src
ON CONFLICT (user_id, phone) DO NOTHING;
"""


def upgrade() -> None:
    op.execute(BACKFILL_SQL)


def downgrade() -> None:
    # Data backfill: no reversible downgrade.
    pass
