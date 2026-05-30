-- Persist the plain share token alongside the hash so we can reuse the same
-- public payment URL across "Share payment link" clicks instead of rotating
-- the token (and SMS link) every time. The plain value is intentionally
-- shareable — it lives in SMS/WhatsApp messages — so storing it is fine.

ALTER TABLE event_contributors
  ADD COLUMN IF NOT EXISTS share_token_plain TEXT NULL;
