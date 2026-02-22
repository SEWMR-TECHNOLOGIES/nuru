from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, Enum, UniqueConstraint, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import (
    VerificationStatusEnum,
    OTPVerificationTypeEnum,
    SocialProviderEnum,
)


# ──────────────────────────────────────────────
# User Tables
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = 'users'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    username = Column(Text, unique=True)
    email = Column(Text, unique=True)
    phone = Column(Text)
    password_hash = Column(Text)
    is_active = Column(Boolean, default=True)
    is_identity_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # One-to-one relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    privacy_setting = relationship("UserPrivacySetting", back_populates="user", uselist=False)
    two_factor_secret = relationship("UserTwoFactorSecret", back_populates="user", uselist=False)
    settings = relationship("UserSetting", back_populates="user", uselist=False)
    attendee_profile = relationship("AttendeeProfile", back_populates="user", uselist=False)

    # One-to-many relationships
    identity_verifications = relationship("UserIdentityVerification", back_populates="user")
    verification_otps = relationship("UserVerificationOTP", back_populates="user")
    social_accounts = relationship("UserSocialAccount", back_populates="user")
    activity_logs = relationship("UserActivityLog", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    user_achievements = relationship("UserAchievement", back_populates="user")
    nuru_cards = relationship("NuruCard", back_populates="user")
    nuru_card_orders = relationship("NuruCardOrder", back_populates="user")
    community_memberships = relationship("CommunityMember", back_populates="user")
    feeds = relationship("UserFeed", back_populates="user")
    feed_glows = relationship("UserFeedGlow", back_populates="user")
    feed_echoes = relationship("UserFeedEcho", back_populates="user")
    feed_comments = relationship("UserFeedComment", back_populates="user")
    feed_comment_glows = relationship("UserFeedCommentGlow", back_populates="user")
    feed_pinned = relationship("UserFeedPinned", back_populates="user")
    feed_saved = relationship("UserFeedSaved", back_populates="user")
    moments = relationship("UserMoment", back_populates="user")
    moment_views = relationship("UserMomentViewer", back_populates="viewer")
    moment_highlights = relationship("UserMomentHighlight", back_populates="user")
    user_services = relationship("UserService", back_populates="user")
    service_ratings = relationship("UserServiceRating", back_populates="user")
    organized_events = relationship("Event", back_populates="organizer")
    contributors = relationship("UserContributor", back_populates="user")
    support_tickets = relationship("SupportTicket", back_populates="user")
    notifications = relationship("Notification", back_populates="recipient")
    booking_requests = relationship("ServiceBookingRequest", back_populates="requester")
    file_uploads = relationship("FileUpload", back_populates="user")
    content_appeals = relationship("ContentAppeal", back_populates="user")
    issues = relationship("Issue", back_populates="user")

    # Self-referential / multi-FK relationships
    blocks_made = relationship("UserBlock", back_populates="blocker", foreign_keys="[UserBlock.blocker_id]")
    blocks_received = relationship("UserBlock", back_populates="blocked", foreign_keys="[UserBlock.blocked_id]")
    circles = relationship("UserCircle", back_populates="user", foreign_keys="[UserCircle.user_id]")
    circle_memberships = relationship("UserCircle", back_populates="circle_member", foreign_keys="[UserCircle.circle_member_id]")
    followers = relationship("UserFollower", back_populates="following", foreign_keys="[UserFollower.following_id]")
    following = relationship("UserFollower", back_populates="follower", foreign_keys="[UserFollower.follower_id]")
    created_communities = relationship("Community", back_populates="creator")
    feed_sparks = relationship("UserFeedSpark", back_populates="shared_by_user")
    service_verifications_submitted = relationship("UserServiceVerification", back_populates="submitted_by_user")
    event_committee_memberships = relationship("EventCommitteeMember", back_populates="user", foreign_keys="[EventCommitteeMember.user_id]")
    event_committee_assignments = relationship("EventCommitteeMember", back_populates="assigner", foreign_keys="[EventCommitteeMember.assigned_by]")
    event_services_as_provider = relationship("EventService", back_populates="provider_user")
    event_service_payments_received = relationship("EventServicePayment", back_populates="provider_user")
    event_invitations_received = relationship("EventInvitation", back_populates="invited_user", foreign_keys="[EventInvitation.invited_user_id]", primaryjoin="User.id == EventInvitation.invited_user_id")
    event_invitations_sent = relationship("EventInvitation", back_populates="invited_by_user", foreign_keys="[EventInvitation.invited_by_user_id]")
    event_attendances = relationship("EventAttendee", back_populates="attendee", foreign_keys="[EventAttendee.attendee_id]", primaryjoin="User.id == EventAttendee.attendee_id")
    conversations_as_one = relationship("Conversation", back_populates="user_one", foreign_keys="[Conversation.user_one_id]")
    conversations_as_two = relationship("Conversation", back_populates="user_two", foreign_keys="[Conversation.user_two_id]")
    sent_messages = relationship("Message", back_populates="sender")
    support_messages = relationship("SupportMessage", back_populates="sender")
    live_chat_sessions_as_user = relationship("LiveChatSession", back_populates="user", foreign_keys="[LiveChatSession.user_id]")
    live_chat_sessions_as_agent = relationship("LiveChatSession", back_populates="agent", foreign_keys="[LiveChatSession.agent_id]")
    live_chat_messages = relationship("LiveChatMessage", back_populates="sender")
    service_review_helpfuls = relationship("ServiceReviewHelpful", back_populates="user")
    recorded_expenses = relationship("EventExpense", back_populates="recorder", foreign_keys="[EventExpense.recorded_by]")


class UserProfile(Base):
    __tablename__ = 'user_profiles'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True)
    bio = Column(Text)
    profile_picture_url = Column(Text)
    social_links = Column(JSONB)
    country_id = Column(UUID(as_uuid=True), ForeignKey('countries.id'))
    website_url = Column(Text)
    location = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="profile")
    country = relationship("Country", back_populates="user_profiles")


class UserIdentityVerification(Base):
    __tablename__ = 'user_identity_verifications'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    document_type_id = Column(UUID(as_uuid=True), ForeignKey('identity_document_requirements.id'))
    document_number = Column(Text, nullable=False)
    document_file_url = Column(Text)
    verification_status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), default=VerificationStatusEnum.pending)
    remarks = Column(Text)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="identity_verifications")
    document_type = relationship("IdentityDocumentRequirement", back_populates="user_identity_verifications")


class UserVerificationOTP(Base):
    __tablename__ = 'user_verification_otps'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    otp_code = Column(Text, nullable=False)
    verification_type = Column(Enum(OTPVerificationTypeEnum, name="otp_verification_type_enum"), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="verification_otps")


class UserBlock(Base):
    __tablename__ = 'user_blocks'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    blocker_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('blocker_id', 'blocked_id', name='uq_user_blocks'),
    )

    # Relationships
    blocker = relationship("User", back_populates="blocks_made", foreign_keys=[blocker_id])
    blocked = relationship("User", back_populates="blocks_received", foreign_keys=[blocked_id])


class UserSocialAccount(Base):
    __tablename__ = 'user_social_accounts'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    provider = Column(Enum(SocialProviderEnum, name="social_provider_enum"), nullable=False)
    provider_user_id = Column(Text, nullable=False)
    provider_email = Column(Text)
    provider_name = Column(Text)
    provider_avatar_url = Column(Text)
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    connected_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'provider', name='uq_user_social_provider'),
        UniqueConstraint('provider', 'provider_user_id', name='uq_provider_user'),
    )

    # Relationships
    user = relationship("User", back_populates="social_accounts")


class UserTwoFactorSecret(Base):
    __tablename__ = 'user_two_factor_secrets'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    secret_key = Column(Text, nullable=False)
    backup_codes = Column(JSONB, server_default="'[]'::jsonb")
    is_enabled = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="two_factor_secret")


class UserPrivacySetting(Base):
    __tablename__ = 'user_privacy_settings'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    profile_visibility = Column(Text, server_default='public')
    show_online_status = Column(Boolean, default=True)
    allow_tagging = Column(Boolean, default=True)
    allow_mentions = Column(Boolean, default=True)
    show_activity_status = Column(Boolean, default=True)
    allow_message_requests = Column(Boolean, default=True)
    hide_from_search = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="privacy_setting")


class UserCircle(Base):
    __tablename__ = 'user_circles'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    circle_member_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    mutual_friends_count = Column(Integer, default=0)
    status = Column(String(20), nullable=False, default='pending')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'circle_member_id', name='uq_user_circle'),
    )

    # Relationships
    user = relationship("User", back_populates="circles", foreign_keys=[user_id])
    circle_member = relationship("User", back_populates="circle_memberships", foreign_keys=[circle_member_id])


class UserFollower(Base):
    __tablename__ = 'user_followers'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    follower_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    following_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('follower_id', 'following_id', name='uq_user_follower'),
    )

    # Relationships
    follower = relationship("User", back_populates="following", foreign_keys=[follower_id])
    following = relationship("User", back_populates="followers", foreign_keys=[following_id])


class UserSetting(Base):
    __tablename__ = 'user_settings'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), unique=True)
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    glows_echoes_notifications = Column(Boolean, default=True)
    event_invitation_notifications = Column(Boolean, default=True)
    follower_notifications = Column(Boolean, default=True)
    message_notifications = Column(Boolean, default=True)
    profile_visibility = Column(Boolean, default=True)
    private_profile = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    dark_mode = Column(Boolean, default=False)
    language = Column(Text, default='en')
    timezone = Column(Text, default='UTC')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="settings")


class UserActivityLog(Base):
    __tablename__ = 'user_activity_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    activity_type = Column(Text, nullable=False)
    entity_type = Column(Text)
    entity_id = Column(UUID(as_uuid=True))
    ip_address = Column(Text)
    user_agent = Column(Text)
    extra_data = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="activity_logs")


class UserSession(Base):
    __tablename__ = 'user_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    token_hash = Column(Text, nullable=False)
    device_info = Column(JSONB)
    ip_address = Column(Text)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = 'password_reset_tokens'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    token_hash = Column(Text, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")


class Achievement(Base):
    __tablename__ = 'achievements'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    icon = Column(Text)
    criteria = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user_achievements = relationship("UserAchievement", back_populates="achievement")


class UserAchievement(Base):
    __tablename__ = 'user_achievements'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    achievement_id = Column(UUID(as_uuid=True), ForeignKey('achievements.id', ondelete='CASCADE'))
    earned_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'achievement_id', name='uq_user_achievement'),
    )

    # Relationships
    user = relationship("User", back_populates="user_achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")
