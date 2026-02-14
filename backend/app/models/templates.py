from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, Enum, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import PriorityLevelEnum, ChecklistItemStatusEnum


# ──────────────────────────────────────────────
# Event Templates & Checklists
# ──────────────────────────────────────────────

class EventTemplate(Base):
    """Pre-built planning template per event type with default tasks, timeline, and budget suggestions."""
    __tablename__ = 'event_templates'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_type_id = Column(UUID(as_uuid=True), ForeignKey('event_types.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    estimated_budget_min = Column(Integer)          # Suggested min budget (TZS)
    estimated_budget_max = Column(Integer)           # Suggested max budget (TZS)
    estimated_timeline_days = Column(Integer)        # How many days before event to start planning
    guest_range_min = Column(Integer)
    guest_range_max = Column(Integer)
    tips = Column(JSONB, server_default="'[]'::jsonb")  # Array of planning tips
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event_type = relationship("EventType", back_populates="templates")
    tasks = relationship("EventTemplateTask", back_populates="template", order_by="EventTemplateTask.display_order")


class EventTemplateTask(Base):
    """Default checklist task that belongs to a template."""
    __tablename__ = 'event_template_tasks'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    template_id = Column(UUID(as_uuid=True), ForeignKey('event_templates.id', ondelete='CASCADE'), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    category = Column(String(50))                     # e.g. "Venue", "Catering", "Decorations"
    priority = Column(Enum(PriorityLevelEnum, name="priority_level_enum", create_type=False), default=PriorityLevelEnum.medium)
    days_before_event = Column(Integer)               # Suggested days before event to complete
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    template = relationship("EventTemplate", back_populates="tasks")


class EventChecklistItem(Base):
    """User's actual checklist item per event — instantiated from template or custom-created."""
    __tablename__ = 'event_checklist_items'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    template_task_id = Column(UUID(as_uuid=True), ForeignKey('event_template_tasks.id', ondelete='SET NULL'), nullable=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    category = Column(String(50))
    priority = Column(Enum(PriorityLevelEnum, name="priority_level_enum", create_type=False), default=PriorityLevelEnum.medium)
    status = Column(Enum(ChecklistItemStatusEnum, name="checklist_item_status_enum"), default=ChecklistItemStatusEnum.pending)
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    assigned_to = Column(Text)                        # Name of person assigned (free text)
    notes = Column(Text)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="checklist_items")
    template_task = relationship("EventTemplateTask")
