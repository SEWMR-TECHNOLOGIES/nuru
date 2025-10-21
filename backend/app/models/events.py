# models/events.py
# Contains all event-related models: EventType, Event, EventService, EventServicePayment, EventServiceStaff

from sqlalchemy import Column, Date, Enum, Integer, String, Text, Boolean, ForeignKey, DateTime, Numeric, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import EventServiceStatusEnum, EventStatusEnum, PaymentStatusEnum, PaymentMethodEnum, PriorityLevelEnum

class EventType(Base):
    __tablename__ = 'event_types'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text)
    icon = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class Event(Base):
    __tablename__ = 'events'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    organizer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    name = Column(Text, nullable=False)
    event_type_id = Column(UUID(as_uuid=True), ForeignKey('event_types.id'))
    description = Column(Text)
    start_date = Column(Date)             # YYYY-MM-DD
    start_time = Column(Time)             # HH:MM
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    expected_guests = Column(Integer)
    location = Column(Text)
    budget = Column(Numeric)
    contributions_total = Column(Numeric, default=0)
    status = Column(Enum(EventStatusEnum), default=EventStatusEnum.draft)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class EventService(Base):
    __tablename__ = 'event_services'
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey('service_types.id', ondelete='CASCADE'), nullable=False)
    provider_user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='SET NULL'), nullable=True)
    provider_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    agreed_price = Column(Numeric, nullable=True)
    is_payment_settled = Column(Boolean, default=False, nullable=False)
    service_status = Column(Enum(EventServiceStatusEnum, name="event_service_status"), default=EventServiceStatusEnum.pending, nullable=False)
    notes = Column(Text, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    event = relationship("Event", backref="services")
    service = relationship("ServiceType")
    provider_service = relationship("UserService", foreign_keys=[provider_user_service_id])
    provider_user = relationship("User", foreign_keys=[provider_user_id])

class EventImage(Base):
    __tablename__ = 'event_images'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    image_url = Column(Text, nullable=False)
    caption = Column(Text, nullable=True)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event = relationship("Event", backref="images")
class EventServicePayment(Base):
    __tablename__ = 'event_service_payments'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_service_id = Column(UUID(as_uuid=True), ForeignKey('event_services.id', ondelete='CASCADE'))
    amount = Column(Numeric, nullable=False)
    status = Column(Enum(PaymentStatusEnum, native_enum=False), default=PaymentStatusEnum.pending)
    payment_date = Column(DateTime, default=func.now())
    method = Column(Enum(PaymentMethodEnum, native_enum=False), nullable=False)
    transaction_ref = Column(Text)


class EventServiceStaff(Base):
    __tablename__ = 'event_service_staff'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_service_id = Column(UUID(as_uuid=True), ForeignKey('event_services.id', ondelete='CASCADE'))
    staff_name = Column(Text, nullable=False)
    role = Column(Text)
    created_at = Column(DateTime, default=func.now())

class EventTypeService(Base):
    __tablename__ = "event_type_services"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_type_id = Column(UUID(as_uuid=True), ForeignKey("event_types.id", ondelete="CASCADE"), nullable=False)
    service_type_id = Column(UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="CASCADE"), nullable=False)
    priority = Column(Enum(PriorityLevelEnum, name="priority_level"),nullable=False,default=PriorityLevelEnum.medium)
    is_mandatory = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event_type = relationship("EventType", backref="recommended_services")
    service_type = relationship("ServiceType")
