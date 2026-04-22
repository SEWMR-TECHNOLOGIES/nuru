-- Per-event saved customisations for contributor messaging composer.
-- Avoids retyping payment info, contact phone, and message template on every send.

CREATE TABLE IF NOT EXISTS event_messaging_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    case_type TEXT NOT NULL CHECK (case_type IN ('no_contribution', 'partial', 'completed')),
    message_template TEXT NULL,
    payment_info TEXT NULL,
    contact_phone TEXT NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_event_messaging_templates_event_case UNIQUE (event_id, case_type)
);

CREATE INDEX IF NOT EXISTS idx_event_messaging_templates_event
    ON event_messaging_templates(event_id);
