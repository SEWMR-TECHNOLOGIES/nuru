from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Numeric, Text, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import PaymentMethodEnum


# ──────────────────────────────────────────────
# Contributors & Contributions
# ──────────────────────────────────────────────

class UserContributor(Base):
    __tablename__ = 'user_contributors'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text)
    phone = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_user_contributor_name'),
    )

    # Relationships
    user = relationship("User", back_populates="contributors")
    event_contributors = relationship("EventContributor", back_populates="contributor")


class EventContributionTarget(Base):
    __tablename__ = 'event_contribution_targets'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    target_amount = Column(Numeric, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="contribution_targets")


class EventContributor(Base):
    __tablename__ = 'event_contributors'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey('user_contributors.id', ondelete='CASCADE'), nullable=False)
    pledge_amount = Column(Numeric, default=0)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('event_id', 'contributor_id', name='uq_event_contributor'),
    )

    # Relationships
    event = relationship("Event", back_populates="event_contributors")
    contributor = relationship("UserContributor", back_populates="event_contributors")
    contributions = relationship("EventContribution", back_populates="event_contributor")


class EventContribution(Base):
    __tablename__ = 'event_contributions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    event_contributor_id = Column(UUID(as_uuid=True), ForeignKey('event_contributors.id', ondelete='CASCADE'), nullable=False)
    contributor_name = Column(Text, nullable=False)
    contributor_contact = Column(JSONB)
    amount = Column(Numeric, nullable=False)
    payment_method = Column(Enum(PaymentMethodEnum, name="payment_method_enum"))
    transaction_ref = Column(Text)
    contributed_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="contributions")
    event_contributor = relationship("EventContributor", back_populates="contributions")
    thank_you_message = relationship("ContributionThankYouMessage", back_populates="contribution", uselist=False)


class ContributionThankYouMessage(Base):
    __tablename__ = 'contribution_thank_you_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    contribution_id = Column(UUID(as_uuid=True), ForeignKey('event_contributions.id', ondelete='CASCADE'), nullable=False, unique=True)
    message = Column(Text, nullable=False)
    sent_via = Column(Text)
    sent_at = Column(DateTime)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="thank_you_messages")
    contribution = relationship("EventContribution", back_populates="thank_you_message")
