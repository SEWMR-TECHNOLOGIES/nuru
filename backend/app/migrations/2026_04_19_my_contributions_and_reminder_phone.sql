-- ============================================================================
-- Migration: My Contributions + Reminder fallback phone
-- Date: 2026-04-19
-- ============================================================================
-- 1) Link user_contributors rows to a Nuru user account (when one exists),
--    so logged-in users can see all events where they are listed as a contributor.
-- 2) Allow the event organiser to specify a fallback contact phone used in
--    reminder messages (defaults to organiser phone if NULL).
-- ============================================================================

-- 1. user_contributors: add contributor_user_id FK
ALTER TABLE user_contributors
  ADD COLUMN IF NOT EXISTS contributor_user_id UUID NULL
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_contributors_contributor_user_id
  ON user_contributors(contributor_user_id);

-- Backfill: link any existing contributor row whose normalised phone matches
-- a registered user. We compare the last 9 digits to handle "+255" / "0" /
-- bare-9-digit variations stored across the table.
UPDATE user_contributors uc
SET contributor_user_id = u.id
FROM users u
WHERE uc.contributor_user_id IS NULL
  AND uc.phone IS NOT NULL
  AND u.phone IS NOT NULL
  AND RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 9)
    = RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9);

-- 2. events: add reminder_contact_phone
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reminder_contact_phone TEXT NULL;
