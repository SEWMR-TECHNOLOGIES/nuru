# models/events.py
# Contains all event-related models: EventType, Event, EventService, EventServicePayment, EventServiceStaff

from sqlalchemy import Column, Text, Boolean, ForeignKey, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.base import Base
from models.enums import event_status_enum, payment_status_enum, payment_method_enum

class EventType(Base):
    __tablename__ = 'event_types'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text)
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
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    location = Column(Text)
    budget = Column(Numeric)
    status = Column(event_status_enum, default='draft')
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class EventService(Base):
    __tablename__ = 'event_services'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'))
    service_id = Column(UUID(as_uuid=True), ForeignKey('service_types.id', ondelete='CASCADE'))
    price = Column(Numeric, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class EventServicePayment(Base):
    __tablename__ = 'event_service_payments'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_service_id = Column(UUID(as_uuid=True), ForeignKey('event_services.id', ondelete='CASCADE'))
    amount = Column(Numeric, nullable=False)
    status = Column(payment_status_enum, default='pending')
    payment_date = Column(DateTime, default=func.now())
    method = Column(payment_method_enum, nullable=False)
    transaction_ref = Column(Text)

class EventServiceStaff(Base):
    __tablename__ = 'event_service_staff'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_service_id = Column(UUID(as_uuid=True), ForeignKey('event_services.id', ondelete='CASCADE'))
    staff_name = Column(Text, nullable=False)
    role = Column(Text)
    created_at = Column(DateTime, default=func.now())
