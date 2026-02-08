from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Reference / Lookup Tables
# ──────────────────────────────────────────────

class Currency(Base):
    __tablename__ = 'currencies'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(String(3), nullable=False, unique=True)
    name = Column(Text, nullable=False)
    symbol = Column(Text, nullable=False)
    decimal_places = Column(Integer, default=2)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    countries = relationship("Country", back_populates="currency")
    events = relationship("Event", back_populates="currency")
    nuru_card_orders = relationship("NuruCardOrder", back_populates="currency")


class Country(Base):
    __tablename__ = 'countries'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(String(2), nullable=False, unique=True)
    name = Column(Text, nullable=False)
    phone_code = Column(Text, nullable=False)
    currency_id = Column(UUID(as_uuid=True), ForeignKey('currencies.id'))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    currency = relationship("Currency", back_populates="countries")
    user_profiles = relationship("UserProfile", back_populates="country")
    nuru_card_orders = relationship("NuruCardOrder", back_populates="delivery_country")


class ServiceCategory(Base):
    __tablename__ = 'service_categories'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    service_types = relationship("ServiceType", back_populates="category")
    user_services = relationship("UserService", back_populates="category")


class KYCRequirement(Base):
    __tablename__ = 'kyc_requirements'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    service_kyc_mappings = relationship("ServiceKYCMapping", back_populates="kyc_requirement")
    verification_files = relationship("UserServiceVerificationFile", back_populates="kyc_requirement")
    kyc_statuses = relationship("UserServiceKYCStatus", back_populates="kyc_requirement")


class ServiceType(Base):
    __tablename__ = 'service_types'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    requires_kyc = Column(Boolean, default=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('service_categories.id'))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    category = relationship("ServiceCategory", back_populates="service_types")
    service_kyc_mappings = relationship("ServiceKYCMapping", back_populates="service_type")
    event_type_services = relationship("EventTypeService", back_populates="service_type")
    event_services = relationship("EventService", back_populates="service_type")
    user_services = relationship("UserService", back_populates="service_type")


class ServiceKYCMapping(Base):
    __tablename__ = 'service_kyc_mapping'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    service_type_id = Column(UUID(as_uuid=True), ForeignKey('service_types.id', ondelete='CASCADE'))
    kyc_requirement_id = Column(UUID(as_uuid=True), ForeignKey('kyc_requirements.id', ondelete='CASCADE'))
    is_mandatory = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    service_type = relationship("ServiceType", back_populates="service_kyc_mappings")
    kyc_requirement = relationship("KYCRequirement", back_populates="service_kyc_mappings")


class IdentityDocumentRequirement(Base):
    __tablename__ = 'identity_document_requirements'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_identity_verifications = relationship("UserIdentityVerification", back_populates="document_type")
