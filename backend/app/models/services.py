from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Numeric, Text, Enum, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import (
    ServiceAvailabilityEnum,
    VerificationStatusEnum,
    UploadFileTypeEnum,
)


# ──────────────────────────────────────────────
# User Services Tables
# ──────────────────────────────────────────────

class UserService(Base):
    __tablename__ = 'user_services'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    category_id = Column(UUID(as_uuid=True), ForeignKey('service_categories.id', ondelete='SET NULL'))
    service_type_id = Column(UUID(as_uuid=True), ForeignKey('service_types.id', ondelete='SET NULL'))
    title = Column(Text, nullable=False)
    description = Column(Text)
    min_price = Column(Numeric)
    max_price = Column(Numeric)
    availability = Column(Enum(ServiceAvailabilityEnum, name="service_availability_enum"), default=ServiceAvailabilityEnum.available)
    verification_status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), default=VerificationStatusEnum.pending)
    verification_progress = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    location = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="user_services")
    category = relationship("ServiceCategory", back_populates="user_services")
    service_type = relationship("ServiceType", back_populates="user_services")
    images = relationship("UserServiceImage", back_populates="user_service")
    packages = relationship("ServicePackage", back_populates="user_service")
    ratings = relationship("UserServiceRating", back_populates="user_service")
    verifications = relationship("UserServiceVerification", back_populates="user_service")
    kyc_statuses = relationship("UserServiceKYCStatus", back_populates="user_service")
    event_services = relationship("EventService", back_populates="provider_user_service")
    conversations = relationship("Conversation", back_populates="service")
    booking_requests = relationship("ServiceBookingRequest", back_populates="user_service")


class UserServiceImage(Base):
    __tablename__ = 'user_service_images'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'))
    image_url = Column(Text, nullable=False)
    description = Column(Text)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_service = relationship("UserService", back_populates="images")


class ServicePackage(Base):
    __tablename__ = 'service_packages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)
    price = Column(Numeric, nullable=False)
    description = Column(Text)
    features = Column(JSONB)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_service = relationship("UserService", back_populates="packages")
    booking_requests = relationship("ServiceBookingRequest", back_populates="package")


class UserServiceRating(Base):
    __tablename__ = 'user_service_ratings'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    rating = Column(Integer, nullable=False)
    review = Column(Text)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='ck_rating_range'),
    )

    # Relationships
    user_service = relationship("UserService", back_populates="ratings")
    user = relationship("User", back_populates="service_ratings")
    photos = relationship("ServiceReviewPhoto", back_populates="rating")
    helpfuls = relationship("ServiceReviewHelpful", back_populates="rating")


class UserServiceVerification(Base):
    __tablename__ = 'user_service_verifications'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'))
    submitted_by_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    verification_status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), default=VerificationStatusEnum.pending)
    remarks = Column(Text)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_service = relationship("UserService", back_populates="verifications")
    submitted_by_user = relationship("User", back_populates="service_verifications_submitted")
    files = relationship("UserServiceVerificationFile", back_populates="verification")
    kyc_statuses = relationship("UserServiceKYCStatus", back_populates="verification")


class UserServiceVerificationFile(Base):
    __tablename__ = 'user_service_verification_files'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    verification_id = Column(UUID(as_uuid=True), ForeignKey('user_service_verifications.id', ondelete='CASCADE'))
    kyc_requirement_id = Column(UUID(as_uuid=True), ForeignKey('kyc_requirements.id', ondelete='CASCADE'))
    file_url = Column(Text, nullable=False)
    file_type = Column(Enum(UploadFileTypeEnum, name="upload_file_type_enum"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    verification = relationship("UserServiceVerification", back_populates="files")
    kyc_requirement = relationship("KYCRequirement", back_populates="verification_files")


class UserServiceKYCStatus(Base):
    __tablename__ = 'user_service_kyc_status'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'), nullable=False)
    kyc_requirement_id = Column(UUID(as_uuid=True), ForeignKey('kyc_requirements.id', ondelete='CASCADE'), nullable=False)
    verification_id = Column(UUID(as_uuid=True), ForeignKey('user_service_verifications.id', ondelete='CASCADE'), nullable=False)
    status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), nullable=False, default=VerificationStatusEnum.pending)
    remarks = Column(Text)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_service = relationship("UserService", back_populates="kyc_statuses")
    kyc_requirement = relationship("KYCRequirement", back_populates="kyc_statuses")
    verification = relationship("UserServiceVerification", back_populates="kyc_statuses")


class ServiceReviewPhoto(Base):
    __tablename__ = 'service_review_photos'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rating_id = Column(UUID(as_uuid=True), ForeignKey('user_service_ratings.id', ondelete='CASCADE'), nullable=False)
    image_url = Column(Text, nullable=False)
    caption = Column(Text)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    rating = relationship("UserServiceRating", back_populates="photos")


class ServiceReviewHelpful(Base):
    __tablename__ = 'service_review_helpful'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rating_id = Column(UUID(as_uuid=True), ForeignKey('user_service_ratings.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    is_helpful = Column(Boolean, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('rating_id', 'user_id', name='uq_review_helpful'),
    )

    # Relationships
    rating = relationship("UserServiceRating", back_populates="helpfuls")
    user = relationship("User", back_populates="service_review_helpfuls")
