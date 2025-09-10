# models/events.py
# Contains all event-related models: EventType, Event, EventService, EventServicePayment, EventServiceStaff

from sqlalchemy import Column, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.base import Base

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
