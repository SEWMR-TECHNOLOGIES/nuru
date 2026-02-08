from sqlalchemy import Column, ForeignKey, DateTime, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Event Schedule & Budget
# ──────────────────────────────────────────────

class EventScheduleItem(Base):
    __tablename__ = 'event_schedule_items'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    location = Column(Text)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="schedule_items")


class EventBudgetItem(Base):
    __tablename__ = 'event_budget_items'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    category = Column(Text, nullable=False)
    item_name = Column(Text, nullable=False)
    estimated_cost = Column(Numeric)
    actual_cost = Column(Numeric)
    vendor_name = Column(Text)
    status = Column(Text, default='pending')
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="budget_items")
