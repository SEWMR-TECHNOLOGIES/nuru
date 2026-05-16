"""SQLAlchemy models for the reminder automation system.

Imported via the central ``models`` package — see ``models/__init__.py``.
"""
from sqlalchemy import (
    Column, Boolean, ForeignKey, DateTime, Integer, Text,
    UniqueConstraint, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


class EventReminderTemplate(Base):
    __tablename__ = "event_reminder_templates"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())
    code = Column(Text, nullable=False, unique=True)
    automation_type = Column(Text, nullable=False)   # fundraise_attend|pledge_remind|guest_remind
    language = Column(Text, nullable=False)          # en|sw
    whatsapp_template_name = Column(Text, nullable=True)
    body_default = Column(Text, nullable=False)
    placeholders = Column(JSONB, nullable=False, server_default="[]")
    required_placeholders = Column(ARRAY(Text), nullable=False,
                                   server_default="{}")
    protected_prefix = Column(Text, nullable=False, server_default="")
    protected_suffix = Column(Text, nullable=False, server_default="")
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("automation_type", "language",
                         name="uq_reminder_templates_type_lang"),
    )


class EventReminderAutomation(Base):
    __tablename__ = "event_reminder_automations"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True),
                      ForeignKey("events.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    automation_type = Column(Text, nullable=False)
    language = Column(Text, nullable=False)
    template_id = Column(UUID(as_uuid=True),
                         ForeignKey("event_reminder_templates.id",
                                    ondelete="RESTRICT"),
                         nullable=False)
    name = Column(Text, nullable=True)
    body_override = Column(Text, nullable=True)
    schedule_kind = Column(Text, nullable=False)     # now|datetime|days_before|hours_before|repeat
    schedule_at = Column(DateTime(timezone=True), nullable=True)
    days_before = Column(Integer, nullable=True)
    hours_before = Column(Integer, nullable=True)
    repeat_interval_hours = Column(Integer, nullable=True)
    min_gap_hours = Column(Integer, nullable=False, server_default="24")
    timezone = Column(Text, nullable=False, server_default="Africa/Nairobi")
    enabled = Column(Boolean, nullable=False, server_default="true")
    created_by = Column(UUID(as_uuid=True),
                        ForeignKey("users.id", ondelete="SET NULL"),
                        nullable=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    template = relationship("EventReminderTemplate", lazy="joined")
    runs = relationship("EventReminderRun", back_populates="automation",
                        cascade="all, delete-orphan")


class EventReminderRun(Base):
    __tablename__ = "event_reminder_runs"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())
    automation_id = Column(UUID(as_uuid=True),
                           ForeignKey("event_reminder_automations.id",
                                      ondelete="CASCADE"),
                           nullable=False)
    event_id = Column(UUID(as_uuid=True),
                      ForeignKey("events.id", ondelete="CASCADE"),
                      nullable=False)
    trigger = Column(Text, nullable=False, server_default="manual")
    status = Column(Text, nullable=False, server_default="pending")
    body_snapshot = Column(Text, nullable=True)
    total_recipients = Column(Integer, nullable=False, server_default="0")
    sent_count = Column(Integer, nullable=False, server_default="0")
    failed_count = Column(Integer, nullable=False, server_default="0")
    skipped_count = Column(Integer, nullable=False, server_default="0")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)

    automation = relationship("EventReminderAutomation", back_populates="runs")
    recipients = relationship("EventReminderRecipient", back_populates="run",
                              cascade="all, delete-orphan")


class EventReminderRecipient(Base):
    __tablename__ = "event_reminder_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())
    run_id = Column(UUID(as_uuid=True),
                    ForeignKey("event_reminder_runs.id", ondelete="CASCADE"),
                    nullable=False)
    recipient_type = Column(Text, nullable=False)  # contributor|guest
    recipient_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    channel = Column(Text, nullable=True)          # whatsapp|sms|skipped
    status = Column(Text, nullable=False, server_default="pending")
    provider_ref = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, server_default="0")
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("run_id", "recipient_type", "recipient_id",
                         name="uq_reminder_recipients_run"),
        Index("idx_reminder_recipients_run_status", "run_id", "status"),
    )

    run = relationship("EventReminderRun", back_populates="recipients")
