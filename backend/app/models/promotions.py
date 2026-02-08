from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Promotions
# ──────────────────────────────────────────────

class Promotion(Base):
    __tablename__ = 'promotions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    title = Column(Text, nullable=False)
    description = Column(Text)
    image_url = Column(Text)
    cta_text = Column(Text)
    cta_url = Column(Text)
    is_active = Column(Boolean, default=True)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PromotedEvent(Base):
    __tablename__ = 'promoted_events'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'))
    boost_level = Column(Text, default='standard')
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    impressions = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    event = relationship("Event", back_populates="promoted_events")
