-- Adds verification + lightweight metadata used by the redesigned mobile UI.

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_communities_is_verified ON communities (is_verified);
