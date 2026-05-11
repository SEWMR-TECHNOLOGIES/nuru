from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import MeetingStatusEnum, MeetingParticipantRoleEnum, MeetingJoinRequestStatusEnum


# ──────────────────────────────────────────────
# Event Meeting Tables
# ──────────────────────────────────────────────

class EventMeeting(Base):
    __tablename__ = 'event_meetings'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    scheduled_at = Column(DateTime, nullable=False)
    timezone = Column(String(64), default='UTC')  # IANA timezone e.g. Africa/Dar_es_Salaam
    duration_minutes = Column(String(10), default='60')
    room_id = Column(String(255), nullable=False, unique=True)
    passcode = Column(String(32))
    status = Column(Enum(MeetingStatusEnum, name="meeting_status_enum"), default=MeetingStatusEnum.scheduled)
    ended_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="meetings")
    creator = relationship("User", back_populates="created_meetings", foreign_keys=[created_by])
    participants = relationship("EventMeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")


class EventMeetingParticipant(Base):
    __tablename__ = 'event_meeting_participants'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('event_meetings.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    role = Column(Enum(MeetingParticipantRoleEnum, name="meeting_participant_role_enum"), default=MeetingParticipantRoleEnum.participant)
    is_notified = Column(Boolean, default=False)
    joined_at = Column(DateTime)
    left_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    meeting = relationship("EventMeeting", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id], back_populates="meeting_participations")
    inviter = relationship("User", foreign_keys=[invited_by])


class EventMeetingJoinRequest(Base):
    __tablename__ = 'event_meeting_join_requests'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    meeting_id = Column(UUID(as_uuid=True), ForeignKey('event_meetings.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    status = Column(Enum(MeetingJoinRequestStatusEnum, name="meeting_join_request_status_enum"), default=MeetingJoinRequestStatusEnum.waiting)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    meeting = relationship("EventMeeting", backref="join_requests")
    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
