from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from core.base import Base


class EventInvitationCardTemplate(Base):
    """Layer-based invitation card design (Canva-style) shared web+mobile."""

    __tablename__ = "event_invitation_card_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(Text, nullable=False, default="Untitled design")
    design_json = Column(JSONB, nullable=False, default=dict)
    preview_image_url = Column(Text)
    is_active = Column(Boolean, nullable=False, default=False)

    canvas_width = Column(Integer, nullable=False, default=1080)
    canvas_height = Column(Integer, nullable=False, default=1350)
    status = Column(Text, nullable=False, default="draft")  # draft|published|archived
    platform = Column(Text, nullable=False, default="web")
    version = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
