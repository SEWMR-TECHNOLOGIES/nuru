"""
Meeting Agenda & Minutes Models
Supports agenda items and meeting minutes/notes for event meetings.
"""

from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


class MeetingAgendaItem(Base):
    __tablename__ = 'meeting_agenda_items'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('event_meetings.id', ondelete='CASCADE'), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    duration_minutes = Column(Integer)
    presenter_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    sort_order = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    meeting = relationship("EventMeeting", backref="agenda_items")
    presenter = relationship("User", foreign_keys=[presenter_user_id])
    creator = relationship("User", foreign_keys=[created_by])


class MeetingMinutes(Base):
    __tablename__ = 'meeting_minutes'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('event_meetings.id', ondelete='CASCADE'), nullable=False, unique=True)
    content = Column(Text, nullable=False)  # Rich text / markdown
    summary = Column(Text)
    decisions = Column(Text)  # Key decisions made
    action_items = Column(Text)  # Action items from the meeting
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    meeting = relationship("EventMeeting", backref="minutes")
    recorder = relationship("User", foreign_keys=[recorded_by])
