"""Dedupe event guests/invitations by (event_id, phone last9).

Revision ID: cafe27053200
Revises: cafe27053100
Create Date: 2026-06-12 12:00:00

Removes duplicate `event_attendees` rows (and their linked
`event_invitations`) that share the same event and the same phone number
(matched on the last 9 digits, ignoring formatting/country-code noise).
The earliest row per (event, phone) is kept; all later duplicates and any
plus-ones attached to them are deleted.

Also drops obvious duplicates among free-text guests with no phone but the
same case-insensitive name on the same event.

Safe to re-run: each statement is idempotent.
"""
from typing import Sequence, Union
from alembic import op


revision: str = "cafe27053200"
down_revision: Union[str, None] = "cafe27053100"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Phone-based dedupe — keep the earliest attendee per (event, last9 phone).
    op.execute(
        """
        WITH ranked AS (
            SELECT
                a.id,
                a.invitation_id,
                ROW_NUMBER() OVER (
                    PARTITION BY a.event_id,
                                 RIGHT(REGEXP_REPLACE(a.guest_phone, '\\D', '', 'g'), 9)
                    ORDER BY a.created_at ASC, a.id ASC
                ) AS rn
            FROM event_attendees a
            WHERE a.guest_phone IS NOT NULL
              AND LENGTH(REGEXP_REPLACE(a.guest_phone, '\\D', '', 'g')) >= 9
        ),
        dups AS (
            SELECT id, invitation_id FROM ranked WHERE rn > 1
        ),
        del_plus_ones AS (
            DELETE FROM event_guest_plus_ones
            WHERE attendee_id IN (SELECT id FROM dups)
            RETURNING 1
        ),
        del_attendees AS (
            DELETE FROM event_attendees
            WHERE id IN (SELECT id FROM dups)
            RETURNING 1
        )
        DELETE FROM event_invitations
        WHERE id IN (SELECT invitation_id FROM dups WHERE invitation_id IS NOT NULL);
        """
    )

    # 2. Name-based dedupe for free-text guests with no phone and no linked
    #    user/contributor — same event + same lowercased name.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                a.id,
                a.invitation_id,
                ROW_NUMBER() OVER (
                    PARTITION BY a.event_id, LOWER(TRIM(a.guest_name))
                    ORDER BY a.created_at ASC, a.id ASC
                ) AS rn
            FROM event_attendees a
            WHERE a.attendee_id IS NULL
              AND a.contributor_id IS NULL
              AND a.guest_name IS NOT NULL
              AND TRIM(a.guest_name) <> ''
              AND (a.guest_phone IS NULL
                   OR LENGTH(REGEXP_REPLACE(a.guest_phone, '\\D', '', 'g')) < 9)
        ),
        dups AS (
            SELECT id, invitation_id FROM ranked WHERE rn > 1
        ),
        del_plus_ones AS (
            DELETE FROM event_guest_plus_ones
            WHERE attendee_id IN (SELECT id FROM dups)
            RETURNING 1
        ),
        del_attendees AS (
            DELETE FROM event_attendees
            WHERE id IN (SELECT id FROM dups)
            RETURNING 1
        )
        DELETE FROM event_invitations
        WHERE id IN (SELECT invitation_id FROM dups WHERE invitation_id IS NOT NULL);
        """
    )

    # 3. Sweep orphaned invitation rows whose contributor/user already has
    #    another invitation on the same event (kept = earliest).
    op.execute(
        """
        WITH ranked AS (
            SELECT
                i.id,
                ROW_NUMBER() OVER (
                    PARTITION BY i.event_id,
                                 COALESCE(i.invited_user_id::text, '') || '|' ||
                                 COALESCE(i.contributor_id::text, '')
                    ORDER BY i.created_at ASC, i.id ASC
                ) AS rn
            FROM event_invitations i
            WHERE (i.invited_user_id IS NOT NULL OR i.contributor_id IS NOT NULL)
        )
        DELETE FROM event_invitations
        WHERE id IN (
            SELECT r.id FROM ranked r
            WHERE r.rn > 1
              AND NOT EXISTS (
                  SELECT 1 FROM event_attendees a WHERE a.invitation_id = r.id
              )
        );
        """
    )


def downgrade() -> None:
    # Data deletion is irreversible.
    pass