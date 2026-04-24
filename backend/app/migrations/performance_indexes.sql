-- ============================================================
-- Performance Indexes for Nuru Backend
-- Run this migration against your PostgreSQL database.
-- All indexes are CREATE ... IF NOT EXISTS or use safe patterns.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- Feed tables - critical for feed loading and N+1 elimination
-- ─────────────────────────────────────────────────────────

-- user_feeds: queries by user_id + is_active, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_user_feeds_user_active_created
  ON user_feeds (user_id, is_active, created_at DESC);

-- user_feeds: visibility filter for public feed
CREATE INDEX IF NOT EXISTS idx_user_feeds_active_visibility_created
  ON user_feeds (is_active, visibility, created_at DESC)
  WHERE is_active = true;

-- user_feeds: trending sort using denormalized counts
CREATE INDEX IF NOT EXISTS idx_user_feeds_engagement_score
  ON user_feeds ((glow_count * 2 + echo_count * 3 + spark_count), created_at DESC)
  WHERE is_active = true;

-- user_feed_images: lookup by feed_id
CREATE INDEX IF NOT EXISTS idx_user_feed_images_feed_id
  ON user_feed_images (feed_id);

-- user_feed_glows: count by feed_id, check by (feed_id, user_id)
CREATE INDEX IF NOT EXISTS idx_user_feed_glows_feed_id
  ON user_feed_glows (feed_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_glows_feed_user
  ON user_feed_glows (feed_id, user_id);

-- user_feed_echoes
CREATE INDEX IF NOT EXISTS idx_user_feed_echoes_feed_id
  ON user_feed_echoes (feed_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_echoes_feed_user
  ON user_feed_echoes (feed_id, user_id);

-- user_feed_sparks
CREATE INDEX IF NOT EXISTS idx_user_feed_sparks_feed_id
  ON user_feed_sparks (feed_id);

-- user_feed_comments: count active by feed_id, reply lookup
CREATE INDEX IF NOT EXISTS idx_user_feed_comments_feed_active
  ON user_feed_comments (feed_id, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_feed_comments_parent
  ON user_feed_comments (parent_comment_id, is_active)
  WHERE is_active = true;

-- user_feed_comment_glows: count by comment_id, check by (comment_id, user_id)
CREATE INDEX IF NOT EXISTS idx_user_feed_comment_glows_comment
  ON user_feed_comment_glows (comment_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_comment_glows_comment_user
  ON user_feed_comment_glows (comment_id, user_id);

-- user_feed_saved: lookup by (feed_id, user_id) and by user
CREATE INDEX IF NOT EXISTS idx_user_feed_saved_feed_user
  ON user_feed_saved (feed_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_saved_user
  ON user_feed_saved (user_id, created_at DESC);

-- user_feed_pinned
CREATE INDEX IF NOT EXISTS idx_user_feed_pinned_feed
  ON user_feed_pinned (feed_id);


-- ─────────────────────────────────────────────────────────
-- User tables
-- ─────────────────────────────────────────────────────────

-- user_profiles: lookup by user_id (should be PK but adding index for safety)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id
  ON user_profiles (user_id);

-- user_circles: circle visibility checks
CREATE INDEX IF NOT EXISTS idx_user_circles_member
  ON user_circles (circle_member_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_circles_user
  ON user_circles (user_id, circle_member_id);

-- user_followers: following/follower lookups
CREATE INDEX IF NOT EXISTS idx_user_followers_follower
  ON user_followers (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_user_followers_following
  ON user_followers (following_id, follower_id);


-- ─────────────────────────────────────────────────────────
-- Events tables
-- ─────────────────────────────────────────────────────────

-- events: public event search
CREATE INDEX IF NOT EXISTS idx_events_public_status
  ON events (is_public, status, start_date ASC)
  WHERE is_public = true;

-- events: organizer lookup
CREATE INDEX IF NOT EXISTS idx_events_organizer
  ON events (organizer_id);

-- event_images: by event_id
CREATE INDEX IF NOT EXISTS idx_event_images_event
  ON event_images (event_id);

-- event_attendees: count by event, and participant lookup
CREATE INDEX IF NOT EXISTS idx_event_attendees_event
  ON event_attendees (event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_attendee
  ON event_attendees (attendee_id);

-- event_settings: by event_id
CREATE INDEX IF NOT EXISTS idx_event_settings_event
  ON event_settings (event_id);

-- event_venue_coordinates: by event_id and geo
CREATE INDEX IF NOT EXISTS idx_event_venue_coords_event
  ON event_venue_coordinates (event_id);
CREATE INDEX IF NOT EXISTS idx_event_venue_coords_geo
  ON event_venue_coordinates (latitude, longitude);


-- ─────────────────────────────────────────────────────────
-- Services tables
-- ─────────────────────────────────────────────────────────

-- user_services: search listing
CREATE INDEX IF NOT EXISTS idx_user_services_active_verified
  ON user_services (is_active, is_verified, verification_status)
  WHERE is_active = true AND is_verified = true;

-- event_services: completed events count
CREATE INDEX IF NOT EXISTS idx_event_services_provider
  ON event_services (provider_user_service_id, service_status);


-- ─────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id, is_read)
  WHERE is_read = false;


-- ─────────────────────────────────────────────────────────
-- Feed ranking tables
-- ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_post_quality_scores_post
  ON post_quality_scores (post_id);

CREATE INDEX IF NOT EXISTS idx_author_affinity_viewer
  ON author_affinity_scores (viewer_id);

CREATE INDEX IF NOT EXISTS idx_user_interest_profiles_user
  ON user_interest_profiles (user_id);


-- ─────────────────────────────────────────────────────────
-- Content moderation / cleanup
-- ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_feeds_inactive_updated
  ON user_feeds (is_active, updated_at)
  WHERE is_active = false;
