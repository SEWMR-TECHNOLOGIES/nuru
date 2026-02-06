# models/services.py
from sqlalchemy import Column, Enum, Integer, Numeric, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.base import Base
from models.enums import ServiceAvailabilityEnum, UploadFileTypeEnum, VerificationStatusEnum

class ServiceCategory(Base):
    __tablename__ = 'service_categories'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())
    service_types = relationship("ServiceType", backref="category")

class KYCRequirement(Base):
    __tablename__ = 'kyc_requirements'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())
    service_kyc_mappings = relationship("ServiceKYCMapping", backref="kyc_requirement")

class ServiceType(Base):
    __tablename__ = 'service_types'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text)
    requires_kyc = Column(Boolean, default=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('service_categories.id'))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())
    service_kyc_mappings = relationship("ServiceKYCMapping", backref="service_type")

class ServiceKYCMapping(Base):
    __tablename__ = 'service_kyc_mapping'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    service_type_id = Column(UUID(as_uuid=True), ForeignKey('service_types.id', ondelete='CASCADE'))
    kyc_requirement_id = Column(UUID(as_uuid=True), ForeignKey('kyc_requirements.id', ondelete='CASCADE'))
    is_mandatory = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class IdentityDocumentRequirement(Base):
    __tablename__ = 'identity_document_requirements'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class UserService(Base):
    __tablename__ = "user_services"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("service_categories.id", ondelete="SET NULL"))
    service_type_id = Column(UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="SET NULL"))
    title = Column(Text, nullable=False)
    description = Column(Text)
    min_price = Column(Numeric)
    max_price = Column(Numeric)
    availability = Column(Enum(ServiceAvailabilityEnum, name="service_availability_enum"), nullable=False, default=ServiceAvailabilityEnum.available)
    verification_status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), nullable=False, default=VerificationStatusEnum.pending)
    verification_progress = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    location = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    images = relationship("UserServiceImage", back_populates="service", cascade="all, delete-orphan")
    ratings = relationship("UserServiceRating", back_populates="service", cascade="all, delete-orphan")
    category = relationship("ServiceCategory", backref="user_services")
    service_type = relationship("ServiceType", backref="user_services")
    verifications = relationship("UserServiceVerification", back_populates="service", cascade="all, delete-orphan")
    kyc_statuses = relationship("UserServiceKYCStatus", back_populates="service", cascade="all, delete-orphan")
    packages = relationship("ServicePackage", back_populates="service", cascade="all, delete-orphan")

class UserServiceImage(Base):
    __tablename__ = "user_service_images"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"))
    image_url = Column(Text, nullable=False)
    description = Column(Text)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    service = relationship("UserService", back_populates="images")

class ServicePackage(Base):
    __tablename__ = "service_packages"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    price = Column(Numeric, nullable=False)
    description = Column(Text)
    features = Column(JSONB, default=list)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    service = relationship("UserService", back_populates="packages")

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
    service = relationship("UserService", back_populates="ratings")
    review_photos = relationship("ServiceReviewPhoto", back_populates="rating", cascade="all, delete-orphan")
    helpful_votes = relationship("ServiceReviewHelpful", back_populates="rating", cascade="all, delete-orphan")

class UserServiceVerification(Base):
    __tablename__ = "user_service_verifications"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"), nullable=False)
    submitted_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    verification_status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), default=VerificationStatusEnum.pending, nullable=False)
    remarks = Column(Text)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    service = relationship("UserService", back_populates="verifications")
    files = relationship("UserServiceVerificationFile", back_populates="verification", cascade="all, delete-orphan")

class UserServiceVerificationFile(Base):
    __tablename__ = "user_service_verification_files"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    verification_id = Column(UUID(as_uuid=True), ForeignKey("user_service_verifications.id", ondelete="CASCADE"), nullable=False)
    kyc_requirement_id = Column(UUID(as_uuid=True), ForeignKey("kyc_requirements.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(Text, nullable=False)
    file_type = Column(Enum(UploadFileTypeEnum, name="upload_file_type_enum"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    verification = relationship("UserServiceVerification", back_populates="files")
    kyc_requirement = relationship("KYCRequirement")

class UserServiceKYCStatus(Base):
    __tablename__ = "user_service_kyc_status"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"), nullable=False)
    kyc_requirement_id = Column(UUID(as_uuid=True), ForeignKey("kyc_requirements.id", ondelete="CASCADE"), nullable=False)
    verification_id = Column(UUID(as_uuid=True), ForeignKey("user_service_verifications.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(VerificationStatusEnum, name="verification_status_enum"), default=VerificationStatusEnum.pending, nullable=False)
    remarks = Column(Text)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    service = relationship("UserService", back_populates="kyc_statuses")
    kyc_requirement = relationship("KYCRequirement")
    verification = relationship("UserServiceVerification")

class ServiceReviewPhoto(Base):
    __tablename__ = "service_review_photos"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rating_id = Column(UUID(as_uuid=True), ForeignKey("user_service_ratings.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=False)
    caption = Column(Text)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    rating = relationship("UserServiceRating", back_populates="review_photos")

class ServiceReviewHelpful(Base):
    __tablename__ = "service_review_helpful"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rating_id = Column(UUID(as_uuid=True), ForeignKey("user_service_ratings.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_helpful = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=func.now())
    rating = relationship("UserServiceRating", back_populates="helpful_votes")
    
class ServiceBookingRequest(Base):
    __tablename__ = "service_booking_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"), nullable=False)
    requester_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="SET NULL"))
    package_id = Column(UUID(as_uuid=True), ForeignKey("service_packages.id"))
    message = Column(Text)
    proposed_price = Column(Numeric)
    quoted_price = Column(Numeric)
    deposit_required = Column(Numeric)
    deposit_paid = Column(Boolean, default=False)
    vendor_notes = Column(Text)
    status = Column(Text, default="pending")
    responded_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    service = relationship("UserService", backref="booking_requests")
    requester = relationship("User", foreign_keys=[requester_user_id])
    package = relationship("ServicePackage")
    event = relationship("Event")
