# models/users.py
from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Numeric, Text, JSON, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base  
from models.enums import MomentContentTypeEnum, MomentPrivacyEnum, SocialProviderEnum, StickerTypeEnum, VerificationStatusEnum, OTPVerificationTypeEnum, RSVPStatusEnum

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
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

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
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class UserVerificationOTP(Base):
    __tablename__ = 'user_verification_otps'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    otp_code = Column(Text, nullable=False)
    verification_type = Column(Enum(OTPVerificationTypeEnum, name="otp_verification_type_enum"), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class AttendeeProfile(Base):
    __tablename__ = 'attendee_profiles'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    rsvp_code = Column(Text, unique=True)
    created_at = Column(DateTime, default=func.now())

class Message(Base):
    __tablename__ = 'messages'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.id', ondelete='CASCADE'))
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, default=list)
    is_read = Column(Boolean, default=False)
    reply_to_id = Column(UUID(as_uuid=True), ForeignKey('messages.id'))
    created_at = Column(DateTime, server_default=func.now())

class UserCircle(Base):
    __tablename__ = 'user_circles'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    circle_member_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    mutual_friends_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserFollower(Base):
    __tablename__ = 'user_followers'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    follower_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    following_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    created_at = Column(DateTime, server_default=func.now())

class UserBlock(Base):
    __tablename__ = 'user_blocks'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    blocker_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    blocked_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

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

class UserSocialAccount(Base):
    __tablename__ = 'user_social_accounts'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
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

class UserTwoFactorSecret(Base):
    __tablename__ = 'user_two_factor_secrets'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), unique=True)
    secret_key = Column(Text, nullable=False)
    backup_codes = Column(JSONB, default='[]')
    is_enabled = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserPrivacySetting(Base):
    __tablename__ = 'user_privacy_settings'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), unique=True)
    profile_visibility = Column(Text, default='public')
    show_online_status = Column(Boolean, default=True)
    allow_tagging = Column(Boolean, default=True)
    allow_mentions = Column(Boolean, default=True)
    show_activity_status = Column(Boolean, default=True)
    allow_message_requests = Column(Boolean, default=True)
    hide_from_search = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserMoment(Base):
    __tablename__ = 'user_moments'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    content_type = Column(Enum(MomentContentTypeEnum, name="moment_content_type_enum"), nullable=False)
    media_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    caption = Column(Text)
    location = Column(Text)
    privacy = Column(Enum(MomentPrivacyEnum, name="moment_privacy_enum"), default=MomentPrivacyEnum.everyone)
    view_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class UserMomentSticker(Base):
    __tablename__ = 'user_moment_stickers'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    moment_id = Column(UUID(as_uuid=True), ForeignKey('user_moments.id', ondelete='CASCADE'))
    sticker_type = Column(Enum(StickerTypeEnum, name="sticker_type_enum"), nullable=False)
    position_x = Column(Numeric, nullable=False)
    position_y = Column(Numeric, nullable=False)
    rotation = Column(Numeric, default=0)
    scale = Column(Numeric, default=1)
    data = Column(JSONB, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class UserMomentViewer(Base):
    __tablename__ = 'user_moment_viewers'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    moment_id = Column(UUID(as_uuid=True), ForeignKey('user_moments.id', ondelete='CASCADE'))
    viewer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    viewed_at = Column(DateTime, server_default=func.now())
    reaction = Column(Text)
    reacted_at = Column(DateTime)

class UserSession(Base):
    __tablename__ = 'user_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(Text, nullable=False)
    device_info = Column(JSONB)
    ip_address = Column(Text)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", backref="sessions")

class PasswordResetToken(Base):
    __tablename__ = 'password_reset_tokens'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(Text, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", backref="password_reset_tokens")

class Achievement(Base):
    __tablename__ = 'achievements'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    icon = Column(Text)
    criteria = Column(JSONB)
    created_at = Column(DateTime, default=func.now())


class UserAchievement(Base):
    __tablename__ = 'user_achievements'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    achievement_id = Column(UUID(as_uuid=True), ForeignKey('achievements.id', ondelete='CASCADE'), nullable=False)
    earned_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'achievement_id', name='uq_user_achievement'),
    )

    user = relationship("User", backref="achievements")
    achievement = relationship("Achievement", backref="users")

class UserActivityLog(Base):
    __tablename__ = 'user_activity_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    activity_type = Column(Text, nullable=False)
    entity_type = Column(Text)
    entity_id = Column(UUID(as_uuid=True))
    ip_address = Column(Text)
    user_agent = Column(Text)
    extra_data = Column(JSONB)  # renamed from 'metadata'
    created_at = Column(DateTime, default=func.now())

