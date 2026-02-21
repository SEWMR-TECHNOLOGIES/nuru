from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Numeric, Text, Enum, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import EventStatusEnum, PriorityLevelEnum


# ──────────────────────────────────────────────
# Event Tables
# ──────────────────────────────────────────────

class EventType(Base):
    __tablename__ = 'event_types'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    icon = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    events = relationship("Event", back_populates="event_type")
    event_type_services = relationship("EventTypeService", back_populates="event_type")
    templates = relationship("EventTemplate", back_populates="event_type")


class Event(Base):
    __tablename__ = 'events'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    organizer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    name = Column(Text, nullable=False)
    event_type_id = Column(UUID(as_uuid=True), ForeignKey('event_types.id'))
    description = Column(Text)
    start_date = Column(DateTime)
    start_time = Column(DateTime)
    end_date = Column(DateTime)
    end_time = Column(DateTime)
    expected_guests = Column(Integer)
    location = Column(Text)
    budget = Column(Numeric)
    contributions_total = Column(Numeric, default=0)
    status = Column(Enum(EventStatusEnum, name="event_status_enum"), default=EventStatusEnum.draft)
    currency_id = Column(UUID(as_uuid=True), ForeignKey('currencies.id'))
    cover_image_url = Column(Text)
    is_public = Column(Boolean, default=False)
    sells_tickets = Column(Boolean, default=False)
    theme_color = Column(String(7))
    dress_code = Column(String(100))
    special_instructions = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    organizer = relationship("User", back_populates="organized_events")
    event_type = relationship("EventType", back_populates="events")
    currency = relationship("Currency", back_populates="events")
    images = relationship("EventImage", back_populates="event")
    venue_coordinate = relationship("EventVenueCoordinate", back_populates="event", uselist=False)
    event_setting = relationship("EventSetting", back_populates="event", uselist=False)
    committee_members = relationship("EventCommitteeMember", back_populates="event")
    event_services = relationship("EventService", back_populates="event")
    contribution_targets = relationship("EventContributionTarget", back_populates="event")
    event_contributors = relationship("EventContributor", back_populates="event")
    contributions = relationship("EventContribution", back_populates="event")
    thank_you_messages = relationship("ContributionThankYouMessage", back_populates="event")
    invitations = relationship("EventInvitation", back_populates="event")
    attendees = relationship("EventAttendee", back_populates="event")
    schedule_items = relationship("EventScheduleItem", back_populates="event")
    budget_items = relationship("EventBudgetItem", back_populates="event")
    booking_requests = relationship("ServiceBookingRequest", back_populates="event")
    promoted_events = relationship("PromotedEvent", back_populates="event")
    checklist_items = relationship("EventChecklistItem", back_populates="event")
    expenses = relationship("EventExpense", back_populates="event")
    photo_libraries = relationship("ServicePhotoLibrary", back_populates="event")
    ticket_classes = relationship("EventTicketClass", back_populates="event")
    tickets = relationship("EventTicket", back_populates="event")


class EventTypeService(Base):
    __tablename__ = 'event_type_services'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_type_id = Column(UUID(as_uuid=True), ForeignKey('event_types.id', ondelete='CASCADE'), nullable=False)
    service_type_id = Column(UUID(as_uuid=True), ForeignKey('service_types.id', ondelete='CASCADE'), nullable=False)
    priority = Column(Enum(PriorityLevelEnum, name="priority_level_enum"), nullable=False, default=PriorityLevelEnum.medium)
    is_mandatory = Column(Boolean, default=True)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event_type = relationship("EventType", back_populates="event_type_services")
    service_type = relationship("ServiceType", back_populates="event_type_services")


class EventImage(Base):
    __tablename__ = 'event_images'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'))
    image_url = Column(Text, nullable=False)
    caption = Column(Text)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="images")


class EventVenueCoordinate(Base):
    __tablename__ = 'event_venue_coordinates'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False, unique=True)
    latitude = Column(Numeric, nullable=False)
    longitude = Column(Numeric, nullable=False)
    formatted_address = Column(Text)
    place_id = Column(Text)
    venue_name = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="venue_coordinate")


class EventSetting(Base):
    __tablename__ = 'event_settings'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False, unique=True)
    rsvp_enabled = Column(Boolean, default=True)
    rsvp_deadline = Column(DateTime)
    allow_plus_ones = Column(Boolean, default=False)
    max_plus_ones = Column(Integer, default=1)
    require_meal_preference = Column(Boolean, default=False)
    meal_options = Column(JSONB, server_default="'[]'::jsonb")
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
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="event_setting")
