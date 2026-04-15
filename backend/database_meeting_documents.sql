-- ============================================
-- Meeting Agenda Items & Minutes Tables
-- Run this migration on your PostgreSQL database
-- ============================================

-- Agenda items for meetings
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES event_meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER,
    presenter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

-- Meeting minutes (one per meeting)
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL UNIQUE REFERENCES event_meetings(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    summary TEXT,
    decisions TEXT,
    action_items TEXT,
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minutes_meeting ON meeting_minutes(meeting_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_agenda_items_modtime ON meeting_agenda_items;
CREATE TRIGGER update_agenda_items_modtime
    BEFORE UPDATE ON meeting_agenda_items
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_minutes_modtime ON meeting_minutes;
CREATE TRIGGER update_minutes_modtime
    BEFORE UPDATE ON meeting_minutes
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
