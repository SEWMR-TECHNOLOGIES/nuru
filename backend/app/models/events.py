# models/events.py
# Contains all event-related models, fully aligned with SQL schema

from sqlalchemy import Column, Date, Enum, Integer, String, Text, Boolean, ForeignKey, DateTime, Numeric, Time
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import (
    EventServiceStatusEnum, EventStatusEnum, PaymentStatusEnum,
    PaymentMethodEnum, PriorityLevelEnum, RSVPStatusEnum
)

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
    start_date = Column(Date)
    start_time = Column(Time)
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    expected_guests = Column(Integer)
    location = Column(Text)
    budget = Column(Numeric)
    contributions_total = Column(Numeric, default=0)
    status = Column(Enum(EventStatusEnum), default=EventStatusEnum.draft)
    currency_id = Column(UUID(as_uuid=True), ForeignKey('currencies.id'))
    cover_image_url = Column(Text)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    services = relationship("EventService", back_populates="event")
    images = relationship("EventImage", back_populates="event")
    invitations = relationship("EventInvitation", back_populates="event")
    attendees = relationship("EventAttendee", back_populates="event")
    venue_coordinates = relationship("EventVenueCoordinate", uselist=False, back_populates="event")
    settings = relationship("EventSetting", uselist=False, back_populates="event")
    contribution_targets = relationship("EventContributionTarget", back_populates="event")
    contributions = relationship("EventContribution", back_populates="event")
    thank_you_messages = relationship("ContributionThankYouMessage", back_populates="event")
    committee_members = relationship("EventCommitteeMember", back_populates="event")

class EventTypeService(Base):
    __tablename__ = "event_type_services"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_type_id = Column(UUID(as_uuid=True), ForeignKey("event_types.id", ondelete="CASCADE"), nullable=False)
    service_type_id = Column(UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="CASCADE"), nullable=False)
    priority = Column(Enum(PriorityLevelEnum, name="priority_level"), nullable=False, default=PriorityLevelEnum.medium)
    is_mandatory = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event_type = relationship("EventType", backref="recommended_services")
    service_type = relationship("ServiceType")

class EventImage(Base):
    __tablename__ = 'event_images'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    image_url = Column(Text, nullable=False)
    caption = Column(Text, nullable=True)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event = relationship("Event", back_populates="images")

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
    event = relationship("Event", back_populates="services")
    service = relationship("ServiceType")
    provider_service = relationship("UserService", foreign_keys=[provider_user_service_id])
    provider_user = relationship("User", foreign_keys=[provider_user_id])

class EventServicePayment(Base):
    __tablename__ = 'event_service_payments'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_service_id = Column(UUID(as_uuid=True), ForeignKey('event_services.id', ondelete='CASCADE'))
    provider_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    amount = Column(Numeric, nullable=False)
    status = Column(Enum(PaymentStatusEnum, native_enum=False), default=PaymentStatusEnum.pending)
    payment_date = Column(DateTime, default=func.now())
    method = Column(Enum(PaymentMethodEnum, native_enum=False), nullable=False)
    transaction_ref = Column(Text)
    provider_transaction_ref = Column(Text)
    event_service = relationship("EventService")

class EventVenueCoordinate(Base):
    __tablename__ = 'event_venue_coordinates'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False, unique=True)
    latitude = Column(Numeric, nullable=False)
    longitude = Column(Numeric, nullable=False)
    formatted_address = Column(Text)
    place_id = Column(Text)
    venue_name = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event = relationship("Event", back_populates="venue_coordinates")

class EventSetting(Base):
    __tablename__ = 'event_settings'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False, unique=True)
    rsvp_enabled = Column(Boolean, default=True)
    rsvp_deadline = Column(DateTime)
    allow_plus_ones = Column(Boolean, default=False)
    max_plus_ones = Column(Integer, default=1)
    require_meal_preference = Column(Boolean, default=False)
    meal_options = Column(JSONB, default=list)
    contributions_enabled = Column(Boolean, default=True)
    contribution_target_amount = Column(Numeric)
    show_contribution_progress = Column(Boolean, default=True)
    allow_anonymous_contributions = Column(Boolean, default=True)
    minimum_contribution = Column(Numeric)
    checkin_enabled = Column(Boolean, default=True)
    allow_nfc_checkin = Column(Boolean, default=True)
    allow_qr_checkin = Column(Boolean, default=True)
    allow_manual_checkin = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)
    show_guest_list = Column(Boolean, default=False)
    show_committee = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event = relationship("Event", back_populates="settings")

class CommitteeRole(Base):
    __tablename__ = 'committee_roles'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    role_name = Column(Text, unique=True, nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class EventCommitteeMember(Base):
    __tablename__ = 'event_committee_members'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    role_id = Column(UUID(as_uuid=True), ForeignKey('committee_roles.id', ondelete='SET NULL'))
    assigned_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    assigned_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    event = relationship("Event", back_populates="committee_members")

class CommitteePermission(Base):
    __tablename__ = 'committee_permissions'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    committee_member_id = Column(UUID(as_uuid=True), ForeignKey('event_committee_members.id', ondelete='CASCADE'), unique=True)
    can_view_guests = Column(Boolean, default=True)
    can_manage_guests = Column(Boolean, default=False)
    can_send_invitations = Column(Boolean, default=False)
    can_check_in_guests = Column(Boolean, default=False)
    can_view_budget = Column(Boolean, default=False)
    can_manage_budget = Column(Boolean, default=False)
    can_view_contributions = Column(Boolean, default=False)
    can_manage_contributions = Column(Boolean, default=False)
    can_view_vendors = Column(Boolean, default=True)
    can_manage_vendors = Column(Boolean, default=False)
    can_approve_bookings = Column(Boolean, default=False)
    can_edit_event = Column(Boolean, default=False)
    can_manage_committee = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class EventInvitation(Base):
    __tablename__ = "event_invitations"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"))
    invited_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    invited_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    invitation_code = Column(Text, unique=True)
    rsvp_status = Column(Enum(RSVPStatusEnum), default=RSVPStatusEnum.pending)
    invited_at = Column(DateTime, default=func.now())
    rsvp_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    sent_via = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    reminder_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    event = relationship("Event", back_populates="invitations")

class EventAttendee(Base):
    __tablename__ = "event_attendees"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"))
    attendee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    invitation_id = Column(UUID(as_uuid=True), ForeignKey("event_invitations.id", ondelete="SET NULL"))
    rsvp_status = Column(Enum(RSVPStatusEnum), default=RSVPStatusEnum.pending)
    checked_in = Column(Boolean, default=False)
    checked_in_at = Column(DateTime, nullable=True)
    nuru_card_id = Column(UUID(as_uuid=True), ForeignKey("nuru_cards.id", ondelete="SET NULL"))
    meal_preference = Column(Text, nullable=True)
    dietary_restrictions = Column(Text, nullable=True)
    special_requests = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    event = relationship("Event", back_populates="attendees")

class EventContributionTarget(Base):
    __tablename__ = "event_contribution_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"))
    target_amount = Column(Numeric, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    event = relationship("Event", back_populates="contribution_targets")


class EventContribution(Base):
    __tablename__ = "event_contributions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"))
    contributor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    contributor_name = Column(Text, nullable=True)
    contributor_contact = Column(JSONB, nullable=True)
    amount = Column(Numeric, nullable=False)
    payment_method = Column(Enum(PaymentMethodEnum), nullable=True)
    transaction_ref = Column(Text, nullable=True)
    contributed_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())

    event = relationship("Event", back_populates="contributions")

class ContributionThankYouMessage(Base):
    __tablename__ = "contribution_thank_you_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    contribution_id = Column(UUID(as_uuid=True), ForeignKey("event_contributions.id", ondelete="CASCADE"), unique=True, nullable=False)
    message = Column(Text, nullable=False)
    sent_via = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    event = relationship("Event", back_populates="thank_you_messages")
    contribution = relationship("EventContribution")