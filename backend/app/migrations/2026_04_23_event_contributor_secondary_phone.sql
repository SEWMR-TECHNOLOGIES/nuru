-- Add secondary_phone + notify_target to event_contributors so per-event
-- overrides actually persist. Mirrors the user_contributors columns.
ALTER TABLE event_contributors
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
  ADD COLUMN IF NOT EXISTS notify_target   TEXT NOT NULL DEFAULT 'primary';

ALTER TABLE event_contributors
  DROP CONSTRAINT IF EXISTS ck_event_contributors_notify_target;
ALTER TABLE event_contributors
  ADD CONSTRAINT ck_event_contributors_notify_target
  CHECK (notify_target IN ('primary','secondary','both'));
