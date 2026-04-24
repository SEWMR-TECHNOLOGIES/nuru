-- One-shot cleanup: strip stray '+' / spaces / dashes from existing
-- secondary_phone values stored on user_contributors and event_contributors,
-- and upgrade local TZ format (07XXXXXXXX) to international (2557XXXXXXXX).
--
-- Going forward, the API normalizes via validate_phone_number on every write,
-- so this is a backfill for rows captured before that fix.

-- 1. Strip non-digits.
UPDATE user_contributors
   SET secondary_phone = regexp_replace(secondary_phone, '[^0-9]', '', 'g')
 WHERE secondary_phone IS NOT NULL
   AND secondary_phone <> regexp_replace(secondary_phone, '[^0-9]', '', 'g');

UPDATE event_contributors
   SET secondary_phone = regexp_replace(secondary_phone, '[^0-9]', '', 'g')
 WHERE secondary_phone IS NOT NULL
   AND secondary_phone <> regexp_replace(secondary_phone, '[^0-9]', '', 'g');

-- 2. Upgrade local TZ '0XXXXXXXXX' → '255XXXXXXXXX'.
UPDATE user_contributors
   SET secondary_phone = '255' || substring(secondary_phone from 2)
 WHERE secondary_phone ~ '^0[67][0-9]{8}$';

UPDATE event_contributors
   SET secondary_phone = '255' || substring(secondary_phone from 2)
 WHERE secondary_phone ~ '^0[67][0-9]{8}$';

-- 3. Upgrade bare 9-digit TZ mobile '7XXXXXXXX' → '255XXXXXXXXX'.
UPDATE user_contributors
   SET secondary_phone = '255' || secondary_phone
 WHERE secondary_phone ~ '^[67][0-9]{8}$';

UPDATE event_contributors
   SET secondary_phone = '255' || secondary_phone
 WHERE secondary_phone ~ '^[67][0-9]{8}$';

-- 4. Empty strings → NULL.
UPDATE user_contributors  SET secondary_phone = NULL WHERE secondary_phone = '';
UPDATE event_contributors SET secondary_phone = NULL WHERE secondary_phone = '';
