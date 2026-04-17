-- ============================================================
-- Performance Indexes v2 — covers tables not in v1
-- All CREATE INDEX IF NOT EXISTS — safe to re-run.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- Messaging
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_user_one         ON conversations (user_one_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_two         ON conversations (user_two_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_service          ON conversations (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conv_created          ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender                ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_unread           ON messages (conversation_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to              ON messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- Notifications (extra)
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_reference        ON notifications (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type_created     ON notifications (type, created_at DESC);

-- ─────────────────────────────────────────────────────────
-- Services (deeper)
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_services_user             ON user_services (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_services_category         ON user_services (category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_services_service_type     ON user_services (service_type_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_services_geo              ON user_services (latitude, longitude) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_service_images_svc        ON user_service_images (user_service_id);
CREATE INDEX IF NOT EXISTS idx_user_service_images_featured   ON user_service_images (user_service_id, is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_service_packages_svc           ON service_packages (user_service_id, display_order);
CREATE INDEX IF NOT EXISTS idx_user_service_ratings_svc       ON user_service_ratings (user_service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_service_ratings_user      ON user_service_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_service_review_photos_rating   ON service_review_photos (rating_id);
CREATE INDEX IF NOT EXISTS idx_service_review_helpful_rating  ON service_review_helpful (rating_id);
CREATE INDEX IF NOT EXISTS idx_service_intro_media_svc        ON service_intro_media (user_service_id);
CREATE INDEX IF NOT EXISTS idx_user_service_kyc_svc           ON user_service_kyc_status (user_service_id);
CREATE INDEX IF NOT EXISTS idx_user_service_verifications_svc ON user_service_verifications (user_service_id);
CREATE INDEX IF NOT EXISTS idx_user_service_verification_files_ver ON user_service_verification_files (verification_id);

-- ─────────────────────────────────────────────────────────
-- Events deep
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_type                    ON events (event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_status_start            ON events (status, start_date);
CREATE INDEX IF NOT EXISTS idx_events_card_template           ON events (card_template_id) WHERE card_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_type_services_event_type ON event_type_services (event_type_id);
CREATE INDEX IF NOT EXISTS idx_event_type_services_service_type ON event_type_services (service_type_id);

-- ─────────────────────────────────────────────────────────
-- Event services / committees / expenses / schedule
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_services_event           ON event_services (event_id);
CREATE INDEX IF NOT EXISTS idx_event_services_provider_user   ON event_services (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_event_services_status          ON event_services (event_id, service_status);
CREATE INDEX IF NOT EXISTS idx_event_service_payments_es      ON event_service_payments (event_service_id);

CREATE INDEX IF NOT EXISTS idx_event_committee_members_event  ON event_committee_members (event_id);
CREATE INDEX IF NOT EXISTS idx_event_committee_members_user   ON event_committee_members (user_id);
CREATE INDEX IF NOT EXISTS idx_event_committee_members_role   ON event_committee_members (role_id);
CREATE INDEX IF NOT EXISTS idx_committee_permissions_member   ON committee_permissions (committee_member_id);

CREATE INDEX IF NOT EXISTS idx_event_expenses_event           ON event_expenses (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_expenses_vendor          ON event_expenses (vendor_id) WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_schedule_items_event     ON event_schedule_items (event_id, start_time);
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event       ON event_budget_items (event_id);
CREATE INDEX IF NOT EXISTS idx_event_budget_items_vendor      ON event_budget_items (vendor_id) WHERE vendor_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- Invitations / RSVPs
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_invitations_event        ON event_invitations (event_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_invitee      ON event_invitations (invitee_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_status   ON event_attendees (event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_event_attendees_attendee_event ON event_attendees (attendee_id, event_id);
CREATE INDEX IF NOT EXISTS idx_attendee_profiles_attendee     ON attendee_profiles (attendee_id);
CREATE INDEX IF NOT EXISTS idx_event_guest_plus_ones_attendee ON event_guest_plus_ones (attendee_id);

-- ─────────────────────────────────────────────────────────
-- Contributions
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_contributors_event        ON user_contributors (event_id);
CREATE INDEX IF NOT EXISTS idx_user_contributors_user         ON user_contributors (user_id);
CREATE INDEX IF NOT EXISTS idx_event_contribution_targets_event ON event_contribution_targets (event_id);
CREATE INDEX IF NOT EXISTS idx_event_contributors_event       ON event_contributors (event_id);
CREATE INDEX IF NOT EXISTS idx_event_contributors_user        ON event_contributors (user_id);
CREATE INDEX IF NOT EXISTS idx_event_contributions_event      ON event_contributions (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_contributions_contributor ON event_contributions (contributor_id);
CREATE INDEX IF NOT EXISTS idx_event_contributions_status     ON event_contributions (event_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_thank_you_messages_event       ON contribution_thank_you_messages (event_id);

-- ─────────────────────────────────────────────────────────
-- Moments
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_moments_user_active       ON user_moments (user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_moments_active_created    ON user_moments (is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_moment_stickers_moment         ON user_moment_stickers (moment_id);
CREATE INDEX IF NOT EXISTS idx_moment_viewers_moment          ON user_moment_viewers (moment_id);
CREATE INDEX IF NOT EXISTS idx_moment_viewers_viewer          ON user_moment_viewers (viewer_id);
CREATE INDEX IF NOT EXISTS idx_moment_highlights_user         ON user_moment_highlights (user_id);
CREATE INDEX IF NOT EXISTS idx_moment_highlight_items_hl      ON user_moment_highlight_items (highlight_id);

-- ─────────────────────────────────────────────────────────
-- Communities
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_communities_active             ON communities (is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_community_members_community    ON community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user         ON community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_community      ON community_posts (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_author         ON community_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_community_post_images_post     ON community_post_images (post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_glows_post      ON community_post_glows (post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_glows_user      ON community_post_glows (post_id, user_id);

-- ─────────────────────────────────────────────────────────
-- Bookings / Promotions / Uploads / Appeals
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booking_requests_service       ON service_booking_requests (user_service_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_event         ON service_booking_requests (event_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status        ON service_booking_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promoted_events_event          ON promoted_events (event_id);
CREATE INDEX IF NOT EXISTS idx_promoted_events_active         ON promoted_events (is_active, end_date) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_file_uploads_user              ON file_uploads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_type              ON file_uploads (file_type);

CREATE INDEX IF NOT EXISTS idx_content_appeals_user           ON content_appeals (user_id);
CREATE INDEX IF NOT EXISTS idx_content_appeals_status         ON content_appeals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_appeals_content        ON content_appeals (content_type, content_id);

-- ─────────────────────────────────────────────────────────
-- Photo libraries
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_photo_libraries_service        ON service_photo_libraries (user_service_id);
CREATE INDEX IF NOT EXISTS idx_photo_libraries_event          ON service_photo_libraries (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photo_library_images_library   ON service_photo_library_images (library_id);

-- ─────────────────────────────────────────────────────────
-- Ticketing
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_ticket_classes_event     ON event_ticket_classes (event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event            ON event_tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_owner            ON event_tickets (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_class            ON event_tickets (ticket_class_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_status           ON event_tickets (event_id, status);

-- ─────────────────────────────────────────────────────────
-- Templates / checklist
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_templates_type           ON event_templates (event_type_id);
CREATE INDEX IF NOT EXISTS idx_event_template_tasks_template  ON event_template_tasks (template_id);
CREATE INDEX IF NOT EXISTS idx_event_checklist_items_event    ON event_checklist_items (event_id, status);

-- ─────────────────────────────────────────────────────────
-- Support
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_tickets_user           ON support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status         ON support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket        ON support_messages (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_user        ON live_chat_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session     ON live_chat_messages (session_id, created_at);

-- ─────────────────────────────────────────────────────────
-- Issues
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_issues_reporter                ON issues (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status                  ON issues (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_category                ON issues (category_id);
CREATE INDEX IF NOT EXISTS idx_issue_responses_issue          ON issue_responses (issue_id, created_at);

-- ─────────────────────────────────────────────────────────
-- Users / sessions / tokens / privacy
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email_lower              ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_phone                    ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username_lower           ON users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user             ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token            ON user_sessions (token_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user        ON user_activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user     ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token    ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker            ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked            ON user_blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_user      ON user_social_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_verification_otps_user    ON user_verification_otps (user_id, verification_type);
CREATE INDEX IF NOT EXISTS idx_user_identity_verifications_user ON user_identity_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user             ON user_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_user_privacy_settings_user     ON user_privacy_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user         ON user_achievements (user_id);

-- ─────────────────────────────────────────────────────────
-- Meetings (extras)
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_meetings_event           ON event_meetings (event_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_event_meetings_creator         ON event_meetings (created_by);
CREATE INDEX IF NOT EXISTS idx_event_meeting_participants_meeting ON event_meeting_participants (meeting_id);
CREATE INDEX IF NOT EXISTS idx_event_meeting_participants_user ON event_meeting_participants (user_id);

-- ─────────────────────────────────────────────────────────
-- WhatsApp
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_conversations_phone         ON wa_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_user          ON wa_conversations (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation       ON wa_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status             ON wa_messages (status);

-- ─────────────────────────────────────────────────────────
-- Page views / analytics
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_page_views_path                ON page_views (path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user                ON page_views (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- Feed ranking deeper
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_interaction_logs_user     ON user_interaction_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interaction_logs_post     ON user_interaction_logs (post_id);
CREATE INDEX IF NOT EXISTS idx_feed_impressions_user          ON feed_impressions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_impressions_post          ON feed_impressions (post_id);

-- ─────────────────────────────────────────────────────────
-- Agreements
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_agreement_acceptances_user ON user_agreement_acceptances (user_id, agreement_type);
CREATE INDEX IF NOT EXISTS idx_agreement_versions_type        ON agreement_versions (agreement_type, is_active);

-- ─────────────────────────────────────────────────────────
-- Nuru cards
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_nuru_cards_user                ON nuru_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_nuru_card_orders_user          ON nuru_card_orders (user_id, status);

-- ─────────────────────────────────────────────────────────
-- ANALYZE to refresh planner stats
-- ─────────────────────────────────────────────────────────
-- Run after creating indexes (uncomment if running ad-hoc):
-- ANALYZE;
