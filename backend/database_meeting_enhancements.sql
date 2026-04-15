-- Meeting system enhancements: waiting room, co-hosts, join requests, timezone
-- Add to your existing meeting tables migration

-- 0. Add timezone column to event_meetings
ALTER TABLE event_meetings ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC';


-- 1. Add role column to event_meeting_participants
DO $$ BEGIN
  CREATE TYPE meeting_participant_role_enum AS ENUM ('creator', 'co_host', 'participant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE event_meeting_participants
  ADD COLUMN IF NOT EXISTS role meeting_participant_role_enum DEFAULT 'participant';

-- 2. Create join requests table (waiting room)
DO $$ BEGIN
  CREATE TYPE meeting_join_request_status_enum AS ENUM ('waiting', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS event_meeting_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES event_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status meeting_join_request_status_enum DEFAULT 'waiting',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_meeting ON event_meeting_join_requests(meeting_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON event_meeting_join_requests(meeting_id, status);

-- 3. Update existing creator participants to have 'creator' role
UPDATE event_meeting_participants emp
SET role = 'creator'
FROM event_meetings em
WHERE emp.meeting_id = em.id
  AND emp.user_id = em.created_by
  AND (emp.role IS NULL OR emp.role = 'participant');
