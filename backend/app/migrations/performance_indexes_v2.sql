-- ============================================================
-- Performance Indexes v2 (Schema Corrected)
-- Safe to re-run
-- PostgreSQL
-- ============================================================

-- ============================================================
-- Messaging
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_user_one
ON conversations (user_one_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_two
ON conversations (user_two_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_service
ON conversations (service_id)
WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
ON messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
ON messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_unread
ON messages (conversation_id, is_read)
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
ON messages (reply_to_id)
WHERE reply_to_id IS NOT NULL;

-- ============================================================
-- Notifications
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_reference
ON notifications (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type_created
ON notifications (type, created_at DESC);

-- ============================================================
-- Services
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_services_user
ON user_services (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_services_category
ON user_services (category_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_services_service_type
ON user_services (service_type_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_services_geo
ON user_services (latitude, longitude)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_service_images_svc
ON user_service_images (user_service_id);

CREATE INDEX IF NOT EXISTS idx_user_service_images_featured
ON user_service_images (user_service_id, is_featured)
WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_service_packages_svc
ON service_packages (user_service_id, display_order);

CREATE INDEX IF NOT EXISTS idx_user_service_ratings_svc
ON user_service_ratings (user_service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_service_ratings_user
ON user_service_ratings (user_id);

-- ============================================================
-- Events
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_type
ON events (event_type_id);

CREATE INDEX IF NOT EXISTS idx_events_status_start
ON events (status, start_date);

CREATE INDEX IF NOT EXISTS idx_events_card_template
ON events (card_template_id)
WHERE card_template_id IS NOT NULL;

-- ============================================================
-- Event Services
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_services_event
ON event_services (event_id);

CREATE INDEX IF NOT EXISTS idx_event_services_provider_user
ON event_services (provider_user_id);

CREATE INDEX IF NOT EXISTS idx_event_services_status
ON event_services (event_id, service_status);

CREATE INDEX IF NOT EXISTS idx_event_service_payments_es
ON event_service_payments (event_service_id);

-- ============================================================
-- Committees
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_committee_members_event
ON event_committee_members (event_id);

CREATE INDEX IF NOT EXISTS idx_event_committee_members_user
ON event_committee_members (user_id);

CREATE INDEX IF NOT EXISTS idx_event_committee_members_role
ON event_committee_members (role_id);

CREATE INDEX IF NOT EXISTS idx_committee_permissions_member
ON committee_permissions (committee_member_id);

-- ============================================================
-- Expenses / Budget / Schedule
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_expenses_event
ON event_expenses (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_expenses_vendor
ON event_expenses (vendor_id)
WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_schedule_items_event
ON event_schedule_items (event_id, start_time);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_event
ON event_budget_items (event_id);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_vendor
ON event_budget_items (vendor_id)
WHERE vendor_id IS NOT NULL;

-- ============================================================
-- Invitations
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_invitations_event
ON event_invitations (event_id);

CREATE INDEX IF NOT EXISTS idx_event_invitations_invited_user
ON event_invitations (invited_user_id);

CREATE INDEX IF NOT EXISTS idx_event_invitations_invited_by_user
ON event_invitations (invited_by_user_id);

CREATE INDEX IF NOT EXISTS idx_event_invitations_event_user
ON event_invitations (event_id, invited_user_id);

-- ============================================================
-- Attendees
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_status
ON event_attendees (event_id, rsvp_status);

CREATE INDEX IF NOT EXISTS idx_event_attendees_attendee_event
ON event_attendees (attendee_id, event_id);

-- ============================================================
-- Contributions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_contributors_user
ON user_contributors (user_id);

CREATE INDEX IF NOT EXISTS idx_event_contributions_event
ON event_contributions (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_contributions_status
ON event_contributions (event_id, confirmation_status);

CREATE INDEX IF NOT EXISTS idx_event_contributions_contributor
ON event_contributions (event_contributor_id);

-- ============================================================
-- Communities
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_communities_public_created
ON communities (is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_members_community
ON community_members (community_id);

CREATE INDEX IF NOT EXISTS idx_community_members_user
ON community_members (user_id);

CREATE INDEX IF NOT EXISTS idx_community_posts_community
ON community_posts (community_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_author
ON community_posts (author_id);

-- ============================================================
-- Users
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email_lower
ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_users_phone
ON users (phone)
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_username_lower
ON users (LOWER(username))
WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
ON user_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token
ON user_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user
ON user_activity_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
ON password_reset_tokens (token_hash);

-- ============================================================
-- Meetings
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_meetings_event
ON event_meetings (event_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_event_meetings_creator
ON event_meetings (created_by);

CREATE INDEX IF NOT EXISTS idx_event_meeting_participants_meeting
ON event_meeting_participants (meeting_id);

CREATE INDEX IF NOT EXISTS idx_event_meeting_participants_user
ON event_meeting_participants (user_id);

-- ============================================================
-- WhatsApp
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wa_conversations_phone
ON wa_conversations (phone);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation
ON wa_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_messages_status
ON wa_messages (status);

-- ============================================================
-- Analytics
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_page_views_path
ON page_views (path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_session
ON page_views (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_visitor
ON page_views (visitor_id, created_at DESC);

-- ============================================================
-- Cards
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_nuru_cards_user
ON nuru_cards (user_id);

CREATE INDEX IF NOT EXISTS idx_nuru_card_orders_user
ON nuru_card_orders (user_id, status);

-- ============================================================
-- Refresh planner statistics after run
-- ============================================================
ANALYZE;
