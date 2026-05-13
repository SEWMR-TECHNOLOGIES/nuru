-- Track when expired moment storage assets have been physically removed
-- from the upload server so the cleanup task is idempotent.

ALTER TABLE user_moments
  ADD COLUMN IF NOT EXISTS media_deleted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_user_moments_expires_media_deleted
  ON user_moments (expires_at)
  WHERE media_deleted_at IS NULL;
