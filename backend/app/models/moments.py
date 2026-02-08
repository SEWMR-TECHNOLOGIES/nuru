from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Numeric, Text, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import MomentContentTypeEnum, MomentPrivacyEnum, StickerTypeEnum


# ──────────────────────────────────────────────
# Moments Tables
# ──────────────────────────────────────────────

class UserMoment(Base):
    __tablename__ = 'user_moments'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content_type = Column(Enum(MomentContentTypeEnum, name="moment_content_type_enum"), nullable=False)
    media_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    caption = Column(Text)
    location = Column(Text)
    privacy = Column(Enum(MomentPrivacyEnum, name="moment_privacy_enum"), default=MomentPrivacyEnum.everyone)
    view_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="moments")
    stickers = relationship("UserMomentSticker", back_populates="moment")
    viewers = relationship("UserMomentViewer", back_populates="moment")
    highlight_items = relationship("UserMomentHighlightItem", back_populates="moment")


class UserMomentSticker(Base):
    __tablename__ = 'user_moment_stickers'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    moment_id = Column(UUID(as_uuid=True), ForeignKey('user_moments.id', ondelete='CASCADE'), nullable=False)
    sticker_type = Column(Enum(StickerTypeEnum, name="sticker_type_enum"), nullable=False)
    position_x = Column(Numeric, nullable=False)
    position_y = Column(Numeric, nullable=False)
    rotation = Column(Numeric, default=0)
    scale = Column(Numeric, default=1)
    data = Column(JSONB, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    moment = relationship("UserMoment", back_populates="stickers")


class UserMomentViewer(Base):
    __tablename__ = 'user_moment_viewers'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    moment_id = Column(UUID(as_uuid=True), ForeignKey('user_moments.id', ondelete='CASCADE'), nullable=False)
    viewer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    viewed_at = Column(DateTime, server_default=func.now())
    reaction = Column(Text)
    reacted_at = Column(DateTime)

    __table_args__ = (
        UniqueConstraint('moment_id', 'viewer_id', name='uq_moment_viewer'),
    )

    # Relationships
    moment = relationship("UserMoment", back_populates="viewers")
    viewer = relationship("User", back_populates="moment_views")


class UserMomentHighlight(Base):
    __tablename__ = 'user_moment_highlights'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = Column(Text, nullable=False)
    cover_image_url = Column(Text)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="moment_highlights")
    items = relationship("UserMomentHighlightItem", back_populates="highlight")


class UserMomentHighlightItem(Base):
    __tablename__ = 'user_moment_highlight_items'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    highlight_id = Column(UUID(as_uuid=True), ForeignKey('user_moment_highlights.id', ondelete='CASCADE'), nullable=False)
    moment_id = Column(UUID(as_uuid=True), ForeignKey('user_moments.id', ondelete='CASCADE'), nullable=False)
    display_order = Column(Integer, default=0)
    added_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('highlight_id', 'moment_id', name='uq_highlight_moment'),
    )

    # Relationships
    highlight = relationship("UserMomentHighlight", back_populates="items")
    moment = relationship("UserMoment", back_populates="highlight_items")
