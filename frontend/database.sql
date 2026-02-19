CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE event_status AS ENUM ('draft', 'confirmed', 'completed', 'published', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'refunded');
CREATE TYPE payment_method AS ENUM ('mobile', 'bank', 'card');
CREATE TYPE rsvp_status AS ENUM ('pending', 'confirmed', 'declined', 'checked_in');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE otp_verification_type AS ENUM ('phone', 'email');
CREATE TYPE conversation_type AS ENUM ('user_to_user', 'user_to_service');
CREATE TYPE event_service_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE service_availability AS ENUM ('available', 'limited', 'unavailable');
CREATE TYPE notification_type AS ENUM (
    'glow', 'echo', 'spark', 'follow', 'event_invite', 'service_approved', 'service_rejected',
    'account_created', 'system', 'contribution_received', 'booking_request', 'booking_accepted',
    'booking_rejected', 'rsvp_received', 'committee_invite', 'moment_view', 'moment_reaction',
    'comment', 'mention', 'circle_add', 'expense_recorded'
);
CREATE TYPE upload_file_type AS ENUM ('image', 'pdf', 'video', 'doc');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE social_provider AS ENUM ('google', 'facebook', 'apple', 'twitter');
CREATE TYPE moment_content_type AS ENUM ('image', 'video');
CREATE TYPE moment_privacy AS ENUM ('everyone', 'circle_only', 'close_friends');
CREATE TYPE sticker_type AS ENUM ('poll', 'question', 'countdown', 'mention', 'location', 'link', 'hashtag');
CREATE TYPE card_order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE card_type AS ENUM ('standard', 'premium', 'custom');
CREATE TYPE chat_session_status AS ENUM ('waiting', 'active', 'ended', 'abandoned');
CREATE TYPE card_type_enum AS ENUM ('standard', 'premium', 'vip');
CREATE TYPE card_order_status_enum AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');

-- RBAC: app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'support');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE IF NOT EXISTS currencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code char(3) NOT NULL UNIQUE,
    name text NOT NULL,
    symbol text NOT NULL,
    decimal_places integer DEFAULT 2,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS countries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code char(2) NOT NULL UNIQUE,
    name text NOT NULL,
    phone_code text NOT NULL,
    currency_id uuid REFERENCES currencies(id),
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(code);

CREATE TABLE IF NOT EXISTS service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kyc_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    requires_kyc boolean DEFAULT false,
    category_id uuid REFERENCES service_categories(id),
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_kyc_mapping (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id uuid REFERENCES service_types(id) ON DELETE CASCADE,
    kyc_requirement_id uuid REFERENCES kyc_requirements(id) ON DELETE CASCADE,
    is_mandatory boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity_document_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    username text UNIQUE,
    email text UNIQUE,
    phone text,
    password_hash text,
    is_active boolean DEFAULT true,
    is_identity_verified boolean DEFAULT false,
    is_phone_verified boolean DEFAULT false,
    is_email_verified boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Admin role enum and admin_users table (completely separate from Nuru users)
CREATE TYPE admin_role AS ENUM ('admin', 'moderator', 'support');

CREATE TABLE IF NOT EXISTS admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    email text NOT NULL UNIQUE,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role admin_role NOT NULL DEFAULT 'support',
    is_active boolean DEFAULT true,
    last_login_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id),
    bio text,
    profile_picture_url text,
    social_links jsonb,
    country_id uuid REFERENCES countries(id),
    website_url text,
    location text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_verification_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    otp_code text NOT NULL,
    verification_type otp_verification_type NOT NULL,
    is_used boolean DEFAULT false,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_identity_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    document_type_id uuid REFERENCES identity_document_requirements(id),
    document_number text NOT NULL,
    document_file_url text,
    verification_status verification_status DEFAULT 'pending',
    remarks text,
    verified_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason text,
    created_at timestamp DEFAULT now(),
    UNIQUE(blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

CREATE TABLE IF NOT EXISTS user_social_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider social_provider NOT NULL,
    provider_user_id text NOT NULL,
    provider_email text,
    provider_name text,
    provider_avatar_url text,
    access_token text,
    refresh_token text,
    token_expires_at timestamp,
    is_active boolean DEFAULT true,
    connected_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(user_id, provider),
    UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_user ON user_social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_provider ON user_social_accounts(provider);

CREATE TABLE IF NOT EXISTS user_two_factor_secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    secret_key text NOT NULL,
    backup_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_enabled boolean DEFAULT false,
    verified_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_2fa_user ON user_two_factor_secrets(user_id);

CREATE TABLE IF NOT EXISTS user_privacy_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    profile_visibility text DEFAULT 'public',
    show_online_status boolean DEFAULT true,
    allow_tagging boolean DEFAULT true,
    allow_mentions boolean DEFAULT true,
    show_activity_status boolean DEFAULT true,
    allow_message_requests boolean DEFAULT true,
    hide_from_search boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_privacy_user ON user_privacy_settings(user_id);

CREATE TABLE IF NOT EXISTS user_circles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    circle_member_id uuid REFERENCES users(id) ON DELETE CASCADE,
    mutual_friends_count integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(user_id, circle_member_id)
);
CREATE INDEX IF NOT EXISTS idx_user_circles_user ON user_circles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_circles_member ON user_circles(circle_member_id);

CREATE TABLE IF NOT EXISTS user_followers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id uuid REFERENCES users(id) ON DELETE CASCADE,
    following_id uuid REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now(),
    UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_user_followers_follower ON user_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_followers_following ON user_followers(following_id);

CREATE TABLE IF NOT EXISTS user_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT true,
    glows_echoes_notifications boolean DEFAULT true,
    event_invitation_notifications boolean DEFAULT true,
    follower_notifications boolean DEFAULT true,
    message_notifications boolean DEFAULT true,
    profile_visibility boolean DEFAULT true,
    private_profile boolean DEFAULT false,
    two_factor_enabled boolean DEFAULT false,
    dark_mode boolean DEFAULT false,
    language text DEFAULT 'en',
    timezone text DEFAULT 'UTC',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    entity_type text,
    entity_id uuid,
    ip_address text,
    user_agent text,
    extra_data jsonb,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON user_activity_logs(activity_type);

CREATE TABLE IF NOT EXISTS communities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    cover_image_url text,
    is_public boolean DEFAULT true,
    member_count integer DEFAULT 0,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    role text DEFAULT 'member',
    joined_at timestamp DEFAULT now(),
    UNIQUE(community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);

CREATE TABLE IF NOT EXISTS community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_community ON community_posts(community_id);

CREATE TABLE IF NOT EXISTS community_post_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_post_images_post ON community_post_images(post_id);

CREATE TABLE IF NOT EXISTS community_post_glows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now(),
    UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_post_glows_post ON community_post_glows(post_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    device_info jsonb,
    ip_address text,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp NOT NULL,
    is_used boolean DEFAULT false,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    icon text,
    criteria jsonb,
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    achievement_id uuid REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at timestamp DEFAULT now(),
    UNIQUE(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

CREATE TABLE IF NOT EXISTS nuru_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    card_number char(12) UNIQUE NOT NULL,
    is_active boolean DEFAULT true,
    issued_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nuru_card_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_type card_type DEFAULT 'standard',
    quantity integer DEFAULT 1,
    delivery_name text NOT NULL,
    delivery_phone text NOT NULL,
    delivery_address text NOT NULL,
    delivery_city text NOT NULL,
    delivery_country_id uuid REFERENCES countries(id),
    delivery_postal_code text,
    delivery_instructions text,
    status card_order_status DEFAULT 'pending',
    tracking_number text,
    shipped_at timestamp,
    delivered_at timestamp,
    amount numeric NOT NULL,
    currency_id uuid REFERENCES currencies(id),
    payment_status payment_status DEFAULT 'pending',
    payment_ref text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_orders_user ON nuru_card_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_card_orders_status ON nuru_card_orders(status);

CREATE TABLE IF NOT EXISTS user_feeds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    title text,
    content text,
    location text,
    is_public boolean DEFAULT true,
    allow_echo boolean DEFAULT true,
    glow_count integer DEFAULT 0,
    echo_count integer DEFAULT 0,
    spark_count integer DEFAULT 0,
    video_url text,
    video_thumbnail_url text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feed_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id uuid REFERENCES user_feeds(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    description text,
    is_featured boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feed_glows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id uuid REFERENCES user_feeds(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feed_echoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id uuid REFERENCES user_feeds(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feed_sparks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id uuid REFERENCES user_feeds(id) ON DELETE CASCADE,
    shared_by_user_id uuid REFERENCES users(id),
    platform text NOT NULL,
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feed_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id uuid NOT NULL REFERENCES user_feeds(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id uuid REFERENCES user_feed_comments(id) ON DELETE CASCADE,
    content text NOT NULL,
    glow_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    is_edited boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_comments_feed ON user_feed_comments(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user ON user_feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_parent ON user_feed_comments(parent_comment_id);

CREATE TABLE IF NOT EXISTS user_feed_comment_glows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES user_feed_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now(),
    UNIQUE(comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_glows_comment ON user_feed_comment_glows(comment_id);

CREATE TABLE IF NOT EXISTS user_feed_pinned (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_id uuid NOT NULL REFERENCES user_feeds(id) ON DELETE CASCADE,
    display_order integer DEFAULT 0,
    pinned_at timestamp DEFAULT now(),
    UNIQUE(user_id, feed_id)
);
CREATE INDEX IF NOT EXISTS idx_feed_pinned_user ON user_feed_pinned(user_id);

CREATE TABLE IF NOT EXISTS user_moments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type moment_content_type NOT NULL,
    media_url text NOT NULL,
    thumbnail_url text,
    caption text,
    location text,
    privacy moment_privacy DEFAULT 'everyone',
    view_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_moments_user ON user_moments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_moments_expires ON user_moments(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_moments_active ON user_moments(is_active, expires_at);

CREATE TABLE IF NOT EXISTS user_moment_stickers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id uuid NOT NULL REFERENCES user_moments(id) ON DELETE CASCADE,
    sticker_type sticker_type NOT NULL,
    position_x numeric NOT NULL,
    position_y numeric NOT NULL,
    rotation numeric DEFAULT 0,
    scale numeric DEFAULT 1,
    data jsonb NOT NULL,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moment_stickers_moment ON user_moment_stickers(moment_id);

CREATE TABLE IF NOT EXISTS user_moment_viewers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id uuid NOT NULL REFERENCES user_moments(id) ON DELETE CASCADE,
    viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at timestamp DEFAULT now(),
    reaction text,
    reacted_at timestamp,
    UNIQUE(moment_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_moment_viewers_moment ON user_moment_viewers(moment_id);
CREATE INDEX IF NOT EXISTS idx_moment_viewers_viewer ON user_moment_viewers(viewer_id);

CREATE TABLE IF NOT EXISTS user_moment_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    cover_image_url text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moment_highlights_user ON user_moment_highlights(user_id);

CREATE TABLE IF NOT EXISTS user_moment_highlight_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    highlight_id uuid NOT NULL REFERENCES user_moment_highlights(id) ON DELETE CASCADE,
    moment_id uuid NOT NULL REFERENCES user_moments(id) ON DELETE CASCADE,
    display_order integer DEFAULT 0,
    added_at timestamp DEFAULT now(),
    UNIQUE(highlight_id, moment_id)
);
CREATE INDEX IF NOT EXISTS idx_moment_highlight_items_highlight ON user_moment_highlight_items(highlight_id);

CREATE TABLE IF NOT EXISTS user_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
    service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    min_price numeric,
    max_price numeric,
    availability service_availability DEFAULT 'available',
    verification_status verification_status DEFAULT 'pending',
    verification_progress integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    location text,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_service_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id uuid REFERENCES user_services(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    description text,
    is_featured boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id uuid NOT NULL REFERENCES user_services(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric NOT NULL,
    description text,
    features jsonb,
    display_order integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_service_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id uuid REFERENCES user_services(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review text,
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_service_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id uuid REFERENCES user_services(id) ON DELETE CASCADE,
    submitted_by_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    verification_status verification_status DEFAULT 'pending',
    remarks text,
    verified_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_service_verification_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id uuid REFERENCES user_service_verifications(id) ON DELETE CASCADE,
    kyc_requirement_id uuid REFERENCES kyc_requirements(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_type upload_file_type,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_service_kyc_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id uuid NOT NULL REFERENCES user_services(id) ON DELETE CASCADE,
    kyc_requirement_id uuid NOT NULL REFERENCES kyc_requirements(id) ON DELETE CASCADE,
    verification_id uuid NOT NULL REFERENCES user_service_verifications(id) ON DELETE CASCADE,
    status verification_status NOT NULL DEFAULT 'pending',
    remarks text,
    reviewed_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_review_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_id uuid NOT NULL REFERENCES user_service_ratings(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    caption text,
    display_order integer DEFAULT 0,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_photos_rating ON service_review_photos(rating_id);

CREATE TABLE IF NOT EXISTS service_review_helpful (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_id uuid NOT NULL REFERENCES user_service_ratings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_helpful boolean NOT NULL,
    created_at timestamp DEFAULT now(),
    UNIQUE(rating_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_review_helpful_rating ON service_review_helpful(rating_id);

CREATE TABLE IF NOT EXISTS event_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    icon varchar(50),
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id uuid REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    event_type_id uuid REFERENCES event_types(id),
    description text,
    start_date date,
    start_time time,
    end_date date,
    end_time time,
    expected_guests integer,
    location text,
    budget numeric,
    contributions_total numeric DEFAULT 0,
    status event_status DEFAULT 'draft',
    currency_id uuid REFERENCES currencies(id),
    cover_image_url text,
    is_public boolean DEFAULT false,
    theme_color varchar(7),
    dress_code varchar(100),
    special_instructions text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_events_currency ON events(currency_id);

CREATE TABLE IF NOT EXISTS event_type_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type_id uuid NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
    service_type_id uuid NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
    priority priority_level NOT NULL DEFAULT 'medium',
    is_mandatory boolean DEFAULT true,
    description text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    caption text,
    is_featured boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_venue_coordinates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    formatted_address text,
    place_id text,
    venue_name text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS idx_venue_coords_event ON event_venue_coordinates(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_coords_location ON event_venue_coordinates(latitude, longitude);

CREATE TABLE IF NOT EXISTS event_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    rsvp_enabled boolean DEFAULT true,
    rsvp_deadline timestamp,
    allow_plus_ones boolean DEFAULT false,
    max_plus_ones integer DEFAULT 1,
    require_meal_preference boolean DEFAULT false,
    meal_options jsonb DEFAULT '[]'::jsonb,
    contributions_enabled boolean DEFAULT true,
    contribution_target_amount numeric,
    show_contribution_progress boolean DEFAULT true,
    allow_anonymous_contributions boolean DEFAULT true,
    minimum_contribution numeric,
    checkin_enabled boolean DEFAULT true,
    allow_nfc_checkin boolean DEFAULT true,
    allow_qr_checkin boolean DEFAULT true,
    allow_manual_checkin boolean DEFAULT true,
    is_public boolean DEFAULT false,
    show_guest_list boolean DEFAULT false,
    show_committee boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_settings_event ON event_settings(event_id);

CREATE TABLE IF NOT EXISTS committee_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name text NOT NULL UNIQUE,
    description text NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_committee_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES committee_roles(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    assigned_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_committee_event ON event_committee_members(event_id);
CREATE INDEX IF NOT EXISTS idx_event_committee_user ON event_committee_members(user_id);
CREATE INDEX IF NOT EXISTS idx_event_committee_role ON event_committee_members(role_id);

CREATE TABLE IF NOT EXISTS committee_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    committee_member_id uuid NOT NULL REFERENCES event_committee_members(id) ON DELETE CASCADE,
    can_view_guests boolean DEFAULT true,
    can_manage_guests boolean DEFAULT false,
    can_send_invitations boolean DEFAULT false,
    can_check_in_guests boolean DEFAULT false,
    can_view_budget boolean DEFAULT false,
    can_manage_budget boolean DEFAULT false,
    can_view_contributions boolean DEFAULT false,
    can_manage_contributions boolean DEFAULT false,
    can_view_vendors boolean DEFAULT true,
    can_manage_vendors boolean DEFAULT false,
    can_approve_bookings boolean DEFAULT false,
    can_edit_event boolean DEFAULT false,
    can_manage_committee boolean DEFAULT false,
    can_view_expenses boolean DEFAULT false,
    can_manage_expenses boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(committee_member_id)
);
CREATE INDEX IF NOT EXISTS idx_committee_perms_member ON committee_permissions(committee_member_id);

-- Event Expenses Table
CREATE TABLE IF NOT EXISTS event_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    payment_method text,
    payment_reference text,
    vendor_name text,
    receipt_url text,
    expense_date timestamp DEFAULT now(),
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_expenses_event ON event_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_recorder ON event_expenses(recorded_by);

CREATE TABLE IF NOT EXISTS event_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
    provider_user_service_id uuid REFERENCES user_services(id) ON DELETE SET NULL,
    provider_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    agreed_price numeric,
    is_payment_settled boolean DEFAULT false NOT NULL,
    service_status event_service_status DEFAULT 'pending' NOT NULL,
    notes text,
    assigned_at timestamp,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_services_event ON event_services(event_id);
CREATE INDEX IF NOT EXISTS idx_event_services_provider_service ON event_services(provider_user_service_id);

CREATE TABLE IF NOT EXISTS event_service_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_service_id uuid REFERENCES event_services(id) ON DELETE CASCADE,
    provider_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    amount numeric NOT NULL,
    status payment_status DEFAULT 'pending',
    payment_date timestamp DEFAULT now(),
    method payment_method NOT NULL,
    transaction_ref text,
    provider_transaction_ref text
);
CREATE INDEX IF NOT EXISTS idx_event_service_payments_event_service ON event_service_payments(event_service_id);

CREATE TABLE IF NOT EXISTS user_contributors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_user_contributors_user ON user_contributors(user_id);

CREATE TABLE IF NOT EXISTS event_contribution_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    target_amount numeric NOT NULL,
    description text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contrib_targets_event ON event_contribution_targets(event_id);

CREATE TABLE IF NOT EXISTS event_contributors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    contributor_id uuid NOT NULL REFERENCES user_contributors(id) ON DELETE CASCADE,
    pledge_amount numeric DEFAULT 0,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(event_id, contributor_id)
);
CREATE INDEX IF NOT EXISTS idx_event_contributors_event ON event_contributors(event_id);

CREATE TABLE IF NOT EXISTS event_contributions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_contributor_id uuid NOT NULL REFERENCES event_contributors(id) ON DELETE CASCADE,
    contributor_name text NOT NULL,
    contributor_contact jsonb,
    amount numeric NOT NULL,
    payment_method payment_method,
    transaction_ref text,
    contributed_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_contributions_event ON event_contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_contributions_contributor ON event_contributions(event_contributor_id);

CREATE TABLE IF NOT EXISTS contribution_thank_you_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    contribution_id uuid NOT NULL REFERENCES event_contributions(id) ON DELETE CASCADE UNIQUE,
    message text NOT NULL,
    sent_via text,
    sent_at timestamp,
    is_sent boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_thank_you_event ON contribution_thank_you_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_thank_you_contribution ON contribution_thank_you_messages(contribution_id);

CREATE TYPE guest_type AS ENUM ('user', 'contributor');

CREATE TABLE IF NOT EXISTS event_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    guest_type guest_type DEFAULT 'user',
    invited_user_id uuid,
    contributor_id uuid REFERENCES user_contributors(id) ON DELETE SET NULL,
    guest_name text,
    invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    invitation_code text UNIQUE,
    rsvp_status rsvp_status DEFAULT 'pending',
    invited_at timestamp DEFAULT now(),
    rsvp_at timestamp,
    notes text,
    sent_via text,
    sent_at timestamp,
    reminder_sent_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_invitations_event ON event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_user ON event_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_event_invitations_contributor ON event_invitations(contributor_id);

CREATE TABLE IF NOT EXISTS event_attendees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    guest_type guest_type DEFAULT 'user',
    attendee_id uuid,
    contributor_id uuid REFERENCES user_contributors(id) ON DELETE SET NULL,
    guest_name text,
    guest_phone text,
    guest_email text,
    invitation_id uuid REFERENCES event_invitations(id) ON DELETE SET NULL,
    rsvp_status rsvp_status DEFAULT 'pending',
    checked_in boolean DEFAULT false,
    checked_in_at timestamp,
    nuru_card_id uuid REFERENCES nuru_cards(id) ON DELETE SET NULL,
    meal_preference text,
    dietary_restrictions text,
    special_requests text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(attendee_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_contributor ON event_attendees(contributor_id);

CREATE TABLE IF NOT EXISTS attendee_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    rsvp_code text UNIQUE,
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_guest_plus_ones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attendee_id uuid NOT NULL REFERENCES event_attendees(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text,
    meal_preference text,
    checked_in boolean DEFAULT false,
    checked_in_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plus_ones_attendee ON event_guest_plus_ones(attendee_id);

CREATE TABLE IF NOT EXISTS event_schedule_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    start_time timestamp NOT NULL,
    end_time timestamp,
    location text,
    display_order integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_items_event ON event_schedule_items(event_id);

CREATE TABLE IF NOT EXISTS event_budget_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category text NOT NULL,
    item_name text NOT NULL,
    estimated_cost numeric,
    actual_cost numeric,
    vendor_name text,
    status text DEFAULT 'pending',
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_items_event ON event_budget_items(event_id);

CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type conversation_type NOT NULL,
    user_one_id uuid REFERENCES users(id) ON DELETE CASCADE,
    user_two_id uuid REFERENCES users(id),
    service_id uuid REFERENCES user_services(id),
    last_read_at timestamp,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    CONSTRAINT uq_user_to_user UNIQUE (user_one_id, user_two_id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT uq_user_to_service UNIQUE (user_one_id, service_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_one ON conversations(user_one_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_two ON conversations(user_two_id);
CREATE INDEX IF NOT EXISTS idx_conversations_service ON conversations(service_id);

CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES users(id) ON DELETE CASCADE,
    message_text text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    is_read boolean DEFAULT false,
    reply_to_id uuid REFERENCES messages(id),
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);

CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    subject text,
    status text DEFAULT 'open',
    priority priority_level DEFAULT 'medium',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
    is_agent boolean DEFAULT false,
    message_text text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

CREATE TABLE IF NOT EXISTS faqs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_order ON faqs(display_order);

CREATE TABLE IF NOT EXISTS live_chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
    status chat_session_status DEFAULT 'waiting',
    started_at timestamp,
    ended_at timestamp,
    wait_time_seconds integer,
    duration_seconds integer,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    feedback text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_user ON live_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_agent ON live_chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_status ON live_chat_sessions(status);

CREATE TABLE IF NOT EXISTS live_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES live_chat_sessions(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
    is_agent boolean DEFAULT false,
    is_system boolean DEFAULT false,
    message_text text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session ON live_chat_messages(session_id); 

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid REFERENCES users(id) ON DELETE CASCADE,
    sender_ids jsonb,
    type notification_type NOT NULL,
    reference_id uuid,
    reference_type text,
    message_template text NOT NULL,
    message_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_booking_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id uuid REFERENCES user_services(id) ON DELETE CASCADE,
    requester_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    event_id uuid REFERENCES events(id) ON DELETE SET NULL,
    package_id uuid REFERENCES service_packages(id),
    message text,
    proposed_price numeric,
    quoted_price numeric,
    deposit_required numeric,
    deposit_paid boolean DEFAULT false,
    vendor_notes text,
    status text DEFAULT 'pending',
    responded_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_requests_service ON service_booking_requests(user_service_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_requester ON service_booking_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_package ON service_booking_requests(package_id);

CREATE TABLE IF NOT EXISTS promotions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    image_url text,
    cta_text text,
    cta_url text,
    is_active boolean DEFAULT true,
    start_date timestamp,
    end_date timestamp,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promoted_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    boost_level text DEFAULT 'standard',
    start_date timestamp,
    end_date timestamp,
    impressions integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promoted_events_event ON promoted_events(event_id);

CREATE TABLE IF NOT EXISTS file_uploads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_type upload_file_type,
    file_size integer,
    original_name text,
    entity_type text,
    entity_id uuid,
    created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_entity ON file_uploads(entity_type, entity_id);

-- SEED DATA
INSERT INTO identity_document_requirements (name, description)
VALUES
  ('Passport', 'Government-issued passport for identity verification'),
  ('National ID', 'National identity card issued by government'),
  ('Driver License', 'Valid driving license issued by government'),
  ('Social Security Card', 'Government-issued social security card for identity verification'),
  ('Voter ID', 'Government-issued voter identification card for identity verification');

INSERT INTO currencies (code, name, symbol, decimal_places) VALUES
  ('KES', 'Kenyan Shilling', 'KSh', 2),
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),
  ('TZS', 'Tanzanian Shilling', 'TSh', 2),
  ('UGX', 'Ugandan Shilling', 'USh', 0),
  ('RWF', 'Rwandan Franc', 'FRw', 0),
  ('ZAR', 'South African Rand', 'R', 2),
  ('NGN', 'Nigerian Naira', '₦', 2);

INSERT INTO countries (code, name, phone_code, currency_id) VALUES
  ('KE', 'Kenya', '+254', (SELECT id FROM currencies WHERE code = 'KES')),
  ('TZ', 'Tanzania', '+255', (SELECT id FROM currencies WHERE code = 'TZS')),
  ('UG', 'Uganda', '+256', (SELECT id FROM currencies WHERE code = 'UGX')),
  ('RW', 'Rwanda', '+250', (SELECT id FROM currencies WHERE code = 'RWF')),
  ('ZA', 'South Africa', '+27', (SELECT id FROM currencies WHERE code = 'ZAR')),
  ('NG', 'Nigeria', '+234', (SELECT id FROM currencies WHERE code = 'NGN')),
  ('US', 'United States', '+1', (SELECT id FROM currencies WHERE code = 'USD')),
  ('GB', 'United Kingdom', '+44', (SELECT id FROM currencies WHERE code = 'GBP'));

INSERT INTO service_categories (name, description)
VALUES
  ('Entertainment', 'This category includes all services that provide amusement or performances during events, such as DJs, live bands, MCs, comedians, and cultural dance groups.'),
  ('Catering', 'This category covers all food and beverage services for events, including meal preparation, buffet setups, drink stations, bartending, and table service.'),
  ('Logistics', 'This category focuses on the movement, setup, and coordination of event equipment and materials, including transportation, loading, and on-site support teams.'),
  ('Photography and Videography', 'This category includes professionals who capture event moments through photography, videography, drone footage, and related editing or production services.'),
  ('Decor and Setup', 'This category covers decoration and setup services for events, including floral arrangements, lighting design, stage setup, and venue styling.'),
  ('Planning', 'This category includes professionals who design, organize, and manage events from start to finish, including scheduling, budgeting, and vendor coordination.'),
  ('Rentals', 'This category includes providers who rent out event materials such as tents, tables, chairs, sound systems, generators, and other essential equipment.'),
  ('Audio Visual', 'This category focuses on technical production services such as sound engineering, lighting systems, screens, projectors, and event broadcasting.'),
  ('Security', 'This category includes services that ensure the safety and order of events, including security guards, bouncers, access control, and emergency response teams.'),
  ('Cleaning', 'This category covers event hygiene and waste management services, including venue cleaning before, during, and after the event, and disposal of waste materials.');

INSERT INTO kyc_requirements (name, description)
VALUES
  ('Government-issued ID', 'Passport, National ID, or Driver''s License'),
  ('Business License', 'Valid license to operate a business legally'),
  ('Tax Compliance Certificate', 'Proof of tax registration and compliance'),
  ('Professional Certification', 'Certificates proving service expertise such as DJ license, catering certificate, or security license'),
  ('Portfolio/Work Samples', 'Photos, videos, or examples demonstrating previous work and experience');

-- Entertainment
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Wedding DJ', 'DJ who performs at weddings and reception parties, managing music and atmosphere', true),
  ('Corporate DJ', 'DJ specialized for conferences, company events, and corporate parties', true),
  ('Live Band', 'Band performing live music with instruments and vocals for events', true),
  ('MC / Host', 'Professional master of ceremonies to guide event flow and engage guests', true),
  ('Cultural Dancers', 'Dance group performing traditional or cultural dance routines at events', true),
  ('Comedian', 'Stand-up or humor performer to entertain guests during events', true)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Entertainment';

-- Catering
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Buffet Catering', 'Catering service offering buffet-style meals for guests', true),
  ('Plated Catering', 'Full-service catering with plated meals and table service', true),
  ('Beverage Service', 'Provides drinks, bartending, and cocktail services for events', true),
  ('Cultural Catering', 'Traditional or regional cuisine catering for special events', true),
  ('Dessert Bar', 'Setup offering cakes, pastries, and other desserts for guests', false)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Catering';

-- Logistics
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Transportation Service', 'Arranges guest transport and shuttle services to and from the event', true),
  ('Equipment Handling', 'Provides setup, transport, and handling of event equipment', true),
  ('Freight and Delivery', 'Manages the delivery and movement of materials and supplies needed for events', true)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Logistics';

-- Photography and Videography
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Event Photographer', 'Captures photos of events including portraits and candid shots', true),
  ('Videographer', 'Records event videos and produces cinematic coverage', true),
  ('Drone Photography', 'Aerial photos and videos using drone equipment', true),
  ('Photo Booth', 'Self-service photo booth with props for guest entertainment', false)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Photography and Videography';

-- Decor and Setup
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Floral Design', 'Creates flower arrangements and decorative floral elements for events', false),
  ('Lighting Setup', 'Designs and installs lighting to enhance event atmosphere and photography', true),
  ('Stage Setup', 'Constructs stages and backdrops for performances or ceremonies', true),
  ('Tent and Seating', 'Provides tents, tables, and seating arrangements for guests', true),
  ('Theme Decoration', 'Complete decoration based on event themes, including props and styling', true)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Decor and Setup';

-- Planning
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT 'Event Planner', 'Organizes and manages all aspects of an event, including scheduling, budgeting, and vendor coordination', true, sc.id
FROM service_categories sc
WHERE sc.name='Planning';

-- Rentals
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Tent Rental', 'Provides tents and coverings for outdoor or indoor events', true),
  ('Furniture Rental', 'Offers tables, chairs, and other furniture for events', true),
  ('Equipment Rental', 'Supplies sound systems, lighting, generators, and other event equipment for hire', true)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Rentals';

-- Audio Visual
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Sound System', 'Supplies and operates sound equipment and public address systems for events', true),
  ('Visual Production', 'Manages screens, projectors, video displays, and event broadcasting', true)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Audio Visual';

-- Security
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Security Personnel', 'Provides security guards, crowd control, and access management for events', true),
  ('Emergency Response', 'Medical or emergency services on standby during events', true)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Security';

-- Cleaning
INSERT INTO service_types (name, description, requires_kyc, category_id)
SELECT t.name, t.description, t.requires_kyc, sc.id
FROM (VALUES
  ('Venue Cleaning', 'Cleans the event venue before, during, and after the event', false),
  ('Waste Management', 'Collects and disposes of waste generated during the event', false)
) AS t(name, description, requires_kyc), service_categories sc
WHERE sc.name = 'Cleaning';

-- Service KYC Mapping
INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Portfolio/Work Samples','Professional Certification')
WHERE st.name IN ('Wedding DJ','Corporate DJ','Live Band','MC / Host','Cultural Dancers','Comedian');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Business License','Tax Compliance Certificate','Portfolio/Work Samples')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Catering');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Portfolio/Work Samples')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Photography and Videography');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Portfolio/Work Samples')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Decor and Setup');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Business License','Portfolio/Work Samples')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Planning');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Business License')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Rentals');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Portfolio/Work Samples','Professional Certification')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Audio Visual');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Professional Certification')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Security');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Business License')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Cleaning');

INSERT INTO service_kyc_mapping (service_type_id, kyc_requirement_id)
SELECT st.id, kr.id
FROM service_types st
JOIN kyc_requirements kr ON kr.name IN ('Government-issued ID','Business License','Tax Compliance Certificate')
WHERE st.category_id = (SELECT id FROM service_categories WHERE name='Logistics')
AND st.requires_kyc = true;

INSERT INTO event_types (name, description, icon)
VALUES
  ('Wedding', 'Ceremonies and receptions celebrating a couple''s marriage', 'Ring'),
  ('Corporate', 'Business events including meetings, conferences, and company parties', 'Briefcase'),
  ('Birthday', 'Celebrations marking a person''s birthday', 'Cake'),
  ('Burial', 'Funeral services and memorial events', 'Cross'),
  ('Anniversary', 'Celebrations for personal or business milestones', 'Heart'),
  ('Product Launch', 'Events to introduce new products or services to the market', 'Bullhorn'),
  ('Conference', 'Professional gatherings, seminars, and workshops', 'Chalkboard'),
  ('Festival', 'Public celebrations or cultural festivals with performances and activities', 'Fireworks'),
  ('Graduation', 'Ceremonies marking educational achievements', 'GraduationCap'),
  ('Baby Shower', 'Celebrations for expecting parents before the birth of a child', 'BabyCarriage'),
  ('Exhibition', 'Trade shows, expos, and art exhibitions showcasing products or work', 'Landmark'),
  ('Send Off', 'Farewell events marking departures, retirements, or goodbyes', 'PlaneDeparture');

INSERT INTO committee_roles (role_name, description)
VALUES
  ('Coordinator', 'Responsible for overall planning and coordination of assigned tasks'),
  ('Logistics', 'Handles equipment, setup, transportation, and logistics'),
  ('Finance', 'Manages budgeting, payments, and contribution tracking'),
  ('Catering', 'Coordinates food and beverage services'),
  ('Decor', 'Handles decoration, stage setup, and venue styling'),
  ('Entertainment', 'Coordinates performers, DJs, and event shows'),
  ('Photography', 'Responsible for capturing photos and videos of the event'),
  ('Security', 'Maintains safety, access control, and emergency response'),
  ('Guest Relations', 'Manages invitations, RSVPs, and guest support'),
  ('Technical Support', 'Handles audiovisual equipment, livestreams, and lighting');

CREATE TABLE IF NOT EXISTS user_feed_saved (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES user_feeds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_feed_saved UNIQUE (user_id, feed_id)
);

CREATE TYPE feed_visibility_enum AS ENUM ('public', 'circle');
ALTER TABLE user_feeds ADD COLUMN visibility feed_visibility_enum DEFAULT 'public';

ALTER TABLE conversations DROP CONSTRAINT uq_user_to_user;
CREATE UNIQUE INDEX uq_user_to_user ON conversations (user_one_id, user_two_id) WHERE service_id IS NULL;

ALTER TABLE nuru_cards ALTER COLUMN card_number TYPE VARCHAR(20)

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cash' BEFORE 'mobile';

ALTER TABLE user_contributors DROP CONSTRAINT IF EXISTS uq_user_contributor_name;
ALTER TABLE user_contributors DROP CONSTRAINT IF EXISTS user_contributors_user_id_name_key;
ALTER TABLE user_contributors ADD CONSTRAINT uq_user_contributor_phone UNIQUE (user_id, phone);

ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS card_type card_type_enum DEFAULT 'standard';
ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS nfc_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS template TEXT;
ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;
ALTER TABLE nuru_cards ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;

UPDATE nuru_cards SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status IS NULL;
UPDATE nuru_cards SET card_type = 'standard' WHERE card_type IS NULL;

-- ──────────────────────────────────────────────
-- Event Templates & Checklists (Phase 1 Feature)
-- ──────────────────────────────────────────────
-- Checklist item status enum
CREATE TYPE checklist_item_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

CREATE TABLE IF NOT EXISTS event_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type_id uuid NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    estimated_budget_min integer,
    estimated_budget_max integer,
    estimated_timeline_days integer,
    guest_range_min integer,
    guest_range_max integer,
    tips jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_templates_type ON event_templates(event_type_id);

CREATE TABLE IF NOT EXISTS event_template_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES event_templates(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    category varchar(50),
    priority priority_level DEFAULT 'medium',
    days_before_event integer,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_template_tasks_template ON event_template_tasks(template_id);

CREATE TABLE IF NOT EXISTS event_checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    template_task_id uuid REFERENCES event_template_tasks(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    category varchar(50),
    priority priority_level DEFAULT 'medium',
    status checklist_item_status DEFAULT 'pending',
    due_date timestamp,
    completed_at timestamp,
    completed_by uuid,
    assigned_to uuid,
    assigned_name text,
    notes text,
    display_order integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_event ON event_checklist_items(event_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_status ON event_checklist_items(status);


-- ============================================================
-- SEED: Event Templates & Tasks for ALL Nuru Event Types
-- Run against your backend PostgreSQL database
-- ============================================================

-- 1. Wedding
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Wedding' LIMIT 1),
  'Complete Wedding Planner',
  'Full wedding planning checklist covering venue, catering, attire, decorations, and logistics.',
  5000000, 30000000, 180, 100, 500,
  '["Book venue at least 6 months in advance","Finalize guest list before sending invitations","Budget 10-15% for unexpected expenses","Hire a day-of coordinator if possible"]'::jsonb, 1
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Book wedding venue', 'Research and secure your ceremony and reception venue', 'Venue', 'high', 180, 1),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Set total budget', 'Define budget categories and spending limits', 'Budget', 'high', 170, 2),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Hire photographer & videographer', 'Compare portfolios and book early', 'Photography', 'high', 150, 3),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Choose catering service', 'Arrange tastings and finalize menu', 'Catering', 'high', 120, 4),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Send invitations', 'Print and distribute or send digital invitations', 'Invitations', 'high', 90, 5),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Book music/DJ/band', 'Confirm entertainment and playlist preferences', 'Music & Entertainment', 'medium', 90, 6),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Order wedding cake', 'Schedule tasting and confirm design', 'Catering', 'medium', 60, 7),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Plan decorations & flowers', 'Choose theme, colors, and floral arrangements', 'Decorations', 'medium', 60, 8),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Arrange transportation', 'Book cars for bridal party and guests', 'Transport', 'medium', 45, 9),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Finalize attire', 'Confirm wedding dress, suits, and accessories', 'Attire', 'high', 45, 10),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Confirm guest RSVPs', 'Follow up with pending responses', 'Coordination', 'high', 21, 11),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Final venue walkthrough', 'Confirm layout, seating, and logistics with venue', 'Venue', 'high', 7, 12),
((SELECT id FROM event_templates WHERE name = 'Complete Wedding Planner' LIMIT 1), 'Prepare day-of timeline', 'Create minute-by-minute schedule for the wedding day', 'Coordination', 'high', 3, 13);

-- 2. Corporate
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Corporate' LIMIT 1),
  'Corporate Event Planner',
  'Organize a professional corporate event, team building, or company party.',
  3000000, 20000000, 60, 30, 300,
  '["Confirm AV requirements early","Prepare name badges and materials in advance","Have a backup agenda item ready","Send calendar invites immediately after confirmation"]'::jsonb, 2
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Define event objectives', 'Clarify goals, target audience, and success metrics', 'Coordination', 'high', 60, 1),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Book venue & AV equipment', 'Secure conference room or hall with required tech', 'Venue', 'high', 45, 2),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Confirm speakers & agenda', 'Finalize speakers, panelists, and session schedule', 'Coordination', 'high', 30, 3),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Send corporate invitations', 'Distribute formal invitations to attendees', 'Invitations', 'high', 30, 4),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Arrange catering & refreshments', 'Book lunch, tea breaks, and dietary accommodations', 'Catering', 'medium', 21, 5),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Prepare materials & handouts', 'Print agendas, name badges, and presentation materials', 'Coordination', 'medium', 7, 6),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Confirm registrations', 'Verify final attendee list and seating', 'Coordination', 'high', 5, 7),
((SELECT id FROM event_templates WHERE name = 'Corporate Event Planner' LIMIT 1), 'Tech rehearsal', 'Test projectors, microphones, and connectivity', 'Venue', 'high', 1, 8);

-- 3. Birthday
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Birthday' LIMIT 1),
  'Birthday Celebration Planner',
  'Organize a memorable birthday party from theme selection to day-of execution.',
  500000, 5000000, 30, 20, 150,
  '["Pick a theme early to guide all decisions","Order cake at least 1 week before","Prepare a backup plan for outdoor events"]'::jsonb, 3
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Choose party theme', 'Decide on a theme to guide decorations, cake, and dress code', 'Coordination', 'high', 30, 1),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Book venue or confirm location', 'Reserve restaurant, hall, or prepare home setup', 'Venue', 'high', 21, 2),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Create guest list & send invites', 'Finalize who to invite and send out invitations', 'Invitations', 'high', 21, 3),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Order birthday cake', 'Choose flavor, design, and confirm delivery', 'Catering', 'high', 7, 4),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Plan food & drinks menu', 'Arrange catering or plan homemade dishes', 'Catering', 'medium', 14, 5),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Buy decorations & supplies', 'Balloons, banners, tableware, party favors', 'Decorations', 'medium', 7, 6),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Arrange entertainment', 'Music playlist, games, or hire MC/DJ', 'Music & Entertainment', 'medium', 7, 7),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Confirm RSVPs', 'Follow up with guests who haven''t responded', 'Coordination', 'medium', 3, 8),
((SELECT id FROM event_templates WHERE name = 'Birthday Celebration Planner' LIMIT 1), 'Set up venue', 'Decorate and arrange seating before guests arrive', 'Venue', 'high', 0, 9);

-- 4. Burial
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Burial' LIMIT 1),
  'Burial & Memorial Planner',
  'Plan a respectful funeral service and burial with all essential arrangements.',
  2000000, 10000000, 14, 50, 300,
  '["Coordinate with religious or cultural leaders early","Prepare a tribute slideshow or booklet","Assign family liaisons for logistics","Set up contribution channels immediately"]'::jsonb, 4
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Secure venue', 'Book church, mosque, hall, or memorial garden', 'Venue', 'high', 10, 1),
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Notify family & friends', 'Send notifications and arrange transport for family', 'Invitations', 'high', 10, 2),
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Coordinate with religious leader', 'Confirm officiant and ceremony program', 'Coordination', 'high', 7, 3),
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Arrange catering', 'Plan post-service meal for attendees', 'Catering', 'medium', 5, 4),
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Prepare tribute materials', 'Create photo display, program booklet, or video tribute', 'Coordination', 'medium', 3, 5),
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Organize contributions', 'Set up contribution channels for family support', 'Budget', 'high', 3, 6),
((SELECT id FROM event_templates WHERE name = 'Burial & Memorial Planner' LIMIT 1), 'Finalize logistics', 'Confirm seating, sound system, and parking', 'Venue', 'high', 1, 7);

-- 5. Anniversary
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Anniversary' LIMIT 1),
  'Anniversary Celebration Planner',
  'Plan a memorable anniversary event for personal or business milestones.',
  1000000, 10000000, 45, 30, 200,
  '["Include a highlight reel or photo timeline of the journey","Personalize decorations with milestone themes","Plan a surprise element for the honoree"]'::jsonb, 5
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Choose theme & milestone focus', 'Decide on a theme reflecting the years celebrated', 'Coordination', 'high', 45, 1),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Book venue', 'Reserve restaurant, hall, or garden', 'Venue', 'high', 30, 2),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Send invitations', 'Create and distribute themed invitations', 'Invitations', 'high', 21, 3),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Arrange catering', 'Plan menu with special cake or toast', 'Catering', 'high', 14, 4),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Book photographer', 'Capture milestone moments', 'Photography', 'medium', 14, 5),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Prepare tribute or slideshow', 'Compile photos and memories for presentation', 'Coordination', 'medium', 7, 6),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Plan decorations', 'Theme-appropriate decorations and centerpieces', 'Decorations', 'medium', 7, 7),
((SELECT id FROM event_templates WHERE name = 'Anniversary Celebration Planner' LIMIT 1), 'Confirm final arrangements', 'Verify headcount, seating, and program', 'Coordination', 'high', 3, 8);

-- 6. Product Launch
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Product Launch' LIMIT 1),
  'Product Launch Planner',
  'Plan a high-impact product or service launch event.',
  5000000, 25000000, 60, 50, 500,
  '["Create buzz on social media before the event","Prepare demo units and samples","Invite media and influencers early","Have a backup presentation plan"]'::jsonb, 6
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Define launch messaging', 'Craft key messages, tagline, and value proposition', 'Coordination', 'high', 60, 1),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Book venue with tech setup', 'Secure venue with stage, screens, and sound system', 'Venue', 'high', 45, 2),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Invite media & influencers', 'Send press invitations and media kits', 'Invitations', 'high', 30, 3),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Prepare product demos', 'Set up demo stations and sample units', 'Coordination', 'high', 14, 4),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Design branded materials', 'Banners, brochures, swag bags, and signage', 'Decorations', 'medium', 14, 5),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Arrange catering & cocktails', 'Plan refreshments for networking', 'Catering', 'medium', 10, 6),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Social media campaign', 'Schedule teaser posts and live coverage plan', 'Coordination', 'high', 7, 7),
((SELECT id FROM event_templates WHERE name = 'Product Launch Planner' LIMIT 1), 'Tech rehearsal & run-through', 'Test all presentations, demos, and AV', 'Venue', 'high', 1, 8);

-- 7. Conference
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Conference' LIMIT 1),
  'Conference & Seminar Planner',
  'Organize a professional conference, seminar, or workshop.',
  5000000, 30000000, 90, 50, 1000,
  '["Confirm speakers at least 2 months ahead","Offer early-bird registration","Plan networking breaks between sessions","Record sessions for post-event content"]'::jsonb, 7
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Define conference theme & tracks', 'Set overall theme and session categories', 'Coordination', 'high', 90, 1),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Book venue & negotiate rates', 'Secure conference center with breakout rooms', 'Venue', 'high', 75, 2),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Invite & confirm speakers', 'Reach out to keynote and panel speakers', 'Coordination', 'high', 60, 3),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Open registration', 'Set up registration page and payment', 'Coordination', 'high', 60, 4),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Sponsor outreach', 'Contact potential sponsors and partners', 'Budget', 'high', 45, 5),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Plan catering & breaks', 'Arrange meals, tea breaks, and dietary options', 'Catering', 'medium', 30, 6),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'Prepare conference materials', 'Badges, programs, notebooks, and swag', 'Coordination', 'medium', 14, 7),
((SELECT id FROM event_templates WHERE name = 'Conference & Seminar Planner' LIMIT 1), 'AV setup & rehearsal', 'Test all technical equipment and streaming', 'Venue', 'high', 2, 8);

-- 8. Festival
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Festival' LIMIT 1),
  'Festival & Cultural Event Planner',
  'Plan a public festival or cultural celebration with performances and activities.',
  10000000, 50000000, 90, 200, 5000,
  '["Secure permits and licenses early","Plan for weather contingencies","Set up multiple activity zones","Coordinate with local authorities for security"]'::jsonb, 8
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Secure venue & permits', 'Book grounds and obtain necessary permits/licenses', 'Venue', 'high', 90, 1),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Book performers & artists', 'Confirm musicians, dancers, and entertainers', 'Music & Entertainment', 'high', 60, 2),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Sponsor & vendor outreach', 'Recruit sponsors and food/merchandise vendors', 'Budget', 'high', 60, 3),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Plan stage & zones layout', 'Design main stage, food court, and activity areas', 'Venue', 'high', 45, 4),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Arrange security & medical', 'Hire security team and first aid station', 'Coordination', 'high', 30, 5),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Marketing & promotion', 'Launch social media, posters, and radio ads', 'Coordination', 'high', 30, 6),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Set up ticketing', 'Configure ticket sales (online and gate)', 'Budget', 'medium', 21, 7),
((SELECT id FROM event_templates WHERE name = 'Festival & Cultural Event Planner' LIMIT 1), 'Final site inspection', 'Walk through venue, test power, and stage', 'Venue', 'high', 2, 8);

-- 9. Graduation
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Graduation' LIMIT 1),
  'Graduation Party Planner',
  'Plan a graduation celebration covering venue, catering, and memorable touches.',
  1000000, 8000000, 45, 30, 200,
  '["Coordinate with ceremony schedule to avoid conflicts","Include a speech or toast moment","Set up a photo corner with props"]'::jsonb, 9
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Set budget', 'Define total budget and category allocations', 'Budget', 'high', 45, 1),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Book venue', 'Reserve hall, restaurant, or outdoor space', 'Venue', 'high', 30, 2),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Send invitations', 'Create and distribute invitations', 'Invitations', 'high', 21, 3),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Arrange catering', 'Plan menu and book catering service', 'Catering', 'high', 14, 4),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Book photographer', 'Capture ceremony and celebration moments', 'Photography', 'medium', 14, 5),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Plan decorations', 'Theme-appropriate decorations and signage', 'Decorations', 'medium', 10, 6),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Prepare speeches & program', 'Coordinate speakers and create event program', 'Coordination', 'medium', 7, 7),
((SELECT id FROM event_templates WHERE name = 'Graduation Party Planner' LIMIT 1), 'Confirm final headcount', 'Finalize RSVPs and catering numbers', 'Coordination', 'high', 3, 8);

-- 10. Baby Shower
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Baby Shower' LIMIT 1),
  'Baby Shower Planner',
  'Organize a joyful baby shower celebration for expecting parents.',
  300000, 3000000, 30, 15, 60,
  '["Coordinate with the parents on theme and preferences","Plan fun games and activities","Prepare a gift registry or contribution list","Consider dietary needs of the expectant mother"]'::jsonb, 10
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Choose theme & colors', 'Pick a theme (gender reveal, neutral, or specific)', 'Coordination', 'high', 30, 1),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Book venue or prepare home', 'Reserve space or decorate at home', 'Venue', 'high', 21, 2),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Send invitations', 'Share themed invitations with guests', 'Invitations', 'high', 21, 3),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Order cake & treats', 'Custom cake matching the theme', 'Catering', 'high', 7, 4),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Plan food & drinks', 'Finger foods, mocktails, and snacks', 'Catering', 'medium', 10, 5),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Buy decorations & supplies', 'Balloons, banners, table settings, and favors', 'Decorations', 'medium', 7, 6),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Plan games & activities', 'Baby bingo, name guessing, and gift opening', 'Music & Entertainment', 'medium', 5, 7),
((SELECT id FROM event_templates WHERE name = 'Baby Shower Planner' LIMIT 1), 'Set up gift station', 'Prepare gift table and registry display', 'Coordination', 'low', 1, 8);

-- 11. Exhibition
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Exhibition' LIMIT 1),
  'Exhibition & Expo Planner',
  'Plan a trade show, art exhibition, or product expo.',
  5000000, 30000000, 60, 100, 2000,
  '["Design an eye-catching booth layout","Prepare digital and printed marketing materials","Plan live demonstrations","Collect visitor contacts for follow-up"]'::jsonb, 11
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Book exhibition space', 'Reserve booth or hall space at venue', 'Venue', 'high', 60, 1),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Design booth & layout', 'Plan booth design, signage, and product displays', 'Decorations', 'high', 30, 2),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Invite exhibitors & vendors', 'Recruit participating exhibitors and sponsors', 'Invitations', 'high', 45, 3),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Prepare marketing materials', 'Brochures, business cards, and giveaways', 'Coordination', 'medium', 14, 4),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Plan demonstrations & talks', 'Schedule product demos and speaker sessions', 'Coordination', 'medium', 14, 5),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Arrange logistics', 'Shipping, setup equipment, and power supply', 'Venue', 'high', 7, 6),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Promote the event', 'Social media, email campaigns, and press releases', 'Coordination', 'high', 21, 7),
((SELECT id FROM event_templates WHERE name = 'Exhibition & Expo Planner' LIMIT 1), 'Final setup & walkthrough', 'Install booth, test equipment, and brief staff', 'Venue', 'high', 1, 8);

-- 12. Send Off
INSERT INTO event_templates (event_type_id, name, description, estimated_budget_min, estimated_budget_max, estimated_timeline_days, guest_range_min, guest_range_max, tips, display_order)
VALUES (
  (SELECT id FROM event_types WHERE name = 'Send Off' LIMIT 1),
  'Send Off & Farewell Planner',
  'Plan a meaningful farewell event for departures, retirements, or goodbyes.',
  500000, 5000000, 21, 20, 100,
  '["Collect memories and messages from attendees beforehand","Prepare a personalized gift or keepsake","Include a speech or tribute moment","Create a memory wall or photo display"]'::jsonb, 12
);
INSERT INTO event_template_tasks (template_id, title, description, category, priority, days_before_event, display_order) VALUES
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Set theme & tone', 'Decide on formal, casual, or surprise farewell', 'Coordination', 'high', 21, 1),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Book venue', 'Reserve restaurant, office space, or outdoor area', 'Venue', 'high', 14, 2),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Send invitations', 'Invite colleagues, friends, and family', 'Invitations', 'high', 14, 3),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Collect messages & memories', 'Gather written notes, photos, and video messages', 'Coordination', 'medium', 10, 4),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Arrange food & drinks', 'Plan catering or potluck-style gathering', 'Catering', 'medium', 7, 5),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Prepare gift or keepsake', 'Organize a group gift, scrapbook, or plaque', 'Coordination', 'medium', 5, 6),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Plan program & speeches', 'Coordinate speakers, toasts, and tribute moments', 'Coordination', 'medium', 3, 7),
((SELECT id FROM event_templates WHERE name = 'Send Off & Farewell Planner' LIMIT 1), 'Decorate & set up', 'Banners, photo displays, and seating arrangements', 'Decorations', 'medium', 0, 8);

INSERT INTO admin_users (full_name, email, username, password_hash, role)
VALUES (
  'Your Name',
  'admin@nuru.tz',
  'admin',
  encode(sha256('yourpassword'::bytea), 'hex'),
  'admin'
);

-- ============================================================
-- NEW: removal_reason and updated_at columns on user_feeds and user_moments
-- ============================================================
ALTER TABLE user_feeds ADD COLUMN IF NOT EXISTS removal_reason TEXT;
ALTER TABLE user_moments ADD COLUMN IF NOT EXISTS removal_reason TEXT;
ALTER TABLE user_moments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- ============================================================
-- NEW: appeal_status and appeal_content_type ENUMs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE appeal_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appeal_content_type_enum AS ENUM ('post', 'moment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- NEW: content_appeals table
-- Users can appeal removal of a post or moment by admin.
-- One appeal per content item (unique constraint).
-- ============================================================
CREATE TABLE IF NOT EXISTS content_appeals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id uuid NOT NULL,
    content_type appeal_content_type_enum NOT NULL,
    appeal_reason text NOT NULL,
    status appeal_status_enum NOT NULL DEFAULT 'pending',
    admin_notes text,
    reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    reviewed_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(user_id, content_id, content_type)
);
CREATE INDEX IF NOT EXISTS idx_content_appeals_user ON content_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_content_appeals_content ON content_appeals(content_id);
CREATE INDEX IF NOT EXISTS idx_content_appeals_status ON content_appeals(status);

-- ──────────────────────────────────────────────
-- PHOTO LIBRARIES (Photography service providers)
-- ──────────────────────────────────────────────

-- Photo library privacy enum
DO $$ BEGIN
  CREATE TYPE photo_library_privacy_enum AS ENUM ('public', 'event_creator_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main library table (one per service+event pair)
CREATE TABLE IF NOT EXISTS service_photo_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_service_id UUID NOT NULL REFERENCES user_services(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    privacy photo_library_privacy_enum NOT NULL DEFAULT 'event_creator_only',
    share_token TEXT NOT NULL UNIQUE,
    photo_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_service_id, event_id)
);

-- Photos within a library
CREATE TABLE IF NOT EXISTS service_photo_library_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES service_photo_libraries(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    original_name TEXT,
    file_size_bytes BIGINT DEFAULT 0,
    width INTEGER,
    height INTEGER,
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spl_service ON service_photo_libraries(user_service_id);
CREATE INDEX IF NOT EXISTS idx_spl_event ON service_photo_libraries(event_id);
CREATE INDEX IF NOT EXISTS idx_spl_token ON service_photo_libraries(share_token);
CREATE INDEX IF NOT EXISTS idx_spli_library ON service_photo_library_images(library_id);


-- ──────────────────────────────────────────────
-- Feed Ranking & Recommendation System
-- ──────────────────────────────────────────────

-- Interaction log: raw signal for ranking
CREATE TABLE IF NOT EXISTS user_interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES user_feeds(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    dwell_time_ms INTEGER,
    session_id TEXT,
    device_type TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interaction_user_post ON user_interaction_logs(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_interaction_user_type ON user_interaction_logs(user_id, interaction_type);
CREATE INDEX IF NOT EXISTS idx_interaction_created ON user_interaction_logs(created_at);

-- Per-user interest vectors
CREATE TABLE IF NOT EXISTS user_interest_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    interest_vector JSONB DEFAULT '{}'::jsonb,
    engagement_stats JSONB DEFAULT '{}'::jsonb,
    negative_signals JSONB DEFAULT '{}'::jsonb,
    last_computed_at TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Precomputed relationship strength between viewer and author
CREATE TABLE IF NOT EXISTS author_affinity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interaction_count INTEGER DEFAULT 0,
    weighted_score FLOAT DEFAULT 0.0,
    is_following BOOLEAN DEFAULT FALSE,
    shared_events_count INTEGER DEFAULT 0,
    is_circle_member BOOLEAN DEFAULT FALSE,
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(viewer_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_affinity_viewer_author ON author_affinity_scores(viewer_id, author_id);
CREATE INDEX IF NOT EXISTS idx_affinity_viewer ON author_affinity_scores(viewer_id);

-- Cached quality score per post
CREATE TABLE IF NOT EXISTS post_quality_scores (
    post_id UUID PRIMARY KEY REFERENCES user_feeds(id) ON DELETE CASCADE,
    engagement_velocity FLOAT DEFAULT 0.0,
    content_richness FLOAT DEFAULT 0.0,
    author_credibility FLOAT DEFAULT 0.5,
    moderation_flag BOOLEAN DEFAULT FALSE,
    spam_probability FLOAT DEFAULT 0.0,
    category TEXT DEFAULT 'general',
    final_quality_score FLOAT DEFAULT 0.5,
    total_engagements INTEGER DEFAULT 0,
    engagement_rate FLOAT DEFAULT 0.0,
    impression_count INTEGER DEFAULT 0,
    last_computed_at TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Feed impressions: tracks what was shown to whom
CREATE TABLE IF NOT EXISTS feed_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES user_feeds(id) ON DELETE CASCADE,
    position INTEGER,
    session_id TEXT,
    was_engaged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impression_user_session ON feed_impressions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_impression_post ON feed_impressions(post_id);
CREATE INDEX IF NOT EXISTS idx_impression_created ON feed_impressions(created_at);

