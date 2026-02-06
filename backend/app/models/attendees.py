# models/attendees.py
# Contains all event attendee and guest-related models except the duplicate EventAttendee

from sqlalchemy import Column, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.base import Base

class EventGuestDetail(Base):
    __tablename__ = 'event_guest_details'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_attendee_id = Column(UUID(as_uuid=True), ForeignKey('event_attendees.id', ondelete='CASCADE'))
    guest_name = Column(Text, nullable=False)

class EventAttendeeNotification(Base):
    __tablename__ = 'event_attendee_notifications'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_attendee_id = Column(UUID(as_uuid=True), ForeignKey('event_attendees.id', ondelete='CASCADE'))
    message = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=func.now())
    channel = Column(Text)
