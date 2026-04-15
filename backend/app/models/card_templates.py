from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Invitation Card Templates
# ──────────────────────────────────────────────

class InvitationCardTemplate(Base):
    __tablename__ = 'invitation_card_templates'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    pdf_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    name_placeholder_x = Column(Numeric, nullable=False, default=50)  # % from left
    name_placeholder_y = Column(Numeric, nullable=False, default=35)  # % from top
    name_font_size = Column(Numeric, nullable=False, default=16)
    name_font_color = Column(Text, nullable=False, default='#000000')
    qr_placeholder_x = Column(Numeric, nullable=False, default=50)   # % from left
    qr_placeholder_y = Column(Numeric, nullable=False, default=75)   # % from top
    qr_size = Column(Numeric, nullable=False, default=80)            # px
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="card_templates")
    events = relationship("Event", back_populates="card_template")
