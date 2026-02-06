# models/users.py
from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base  
from models.enums import VerificationStatusEnum, OTPVerificationTypeEnum, RSVPStatusEnum

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

class UserFeed(Base):
    __tablename__ = 'user_feeds'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    title = Column(Text)
    content = Column(Text)
    location = Column(Text)
    is_public = Column(Boolean, default=True)
    allow_echo = Column(Boolean, default=True)
    glow_count = Column(Integer, default=0)
    echo_count = Column(Integer, default=0)
    spark_count = Column(Integer, default=0)
    video_url = Column(Text)
    video_thumbnail_url = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserServiceRating(Base):
    __tablename__ = "user_service_ratings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    rating = Column(Integer, nullable=False)
    review = Column(Text)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

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

