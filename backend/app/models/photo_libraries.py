from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, BigInteger, Text, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import PhotoLibraryPrivacyEnum


# ──────────────────────────────────────────────
# Photo Libraries (for Photography service providers)
# ──────────────────────────────────────────────

class ServicePhotoLibrary(Base):
    __tablename__ = 'service_photo_libraries'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)              # auto-generated from event name
    description = Column(Text)
    privacy = Column(Enum(PhotoLibraryPrivacyEnum, name="photo_library_privacy_enum"), nullable=False, default=PhotoLibraryPrivacyEnum.event_creator_only)
    share_token = Column(Text, unique=True, nullable=False)  # used for public share links
    photo_count = Column(Integer, default=0)
    total_size_bytes = Column(BigInteger, default=0)  # tracked cumulatively
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_service = relationship("UserService", back_populates="photo_libraries")
    event = relationship("Event", back_populates="photo_libraries")
    photos = relationship("ServicePhotoLibraryImage", back_populates="library", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('user_service_id', 'event_id', name='uq_service_event_library'),
    )


class ServicePhotoLibraryImage(Base):
    __tablename__ = 'service_photo_library_images'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    library_id = Column(UUID(as_uuid=True), ForeignKey('service_photo_libraries.id', ondelete='CASCADE'), nullable=False)
    image_url = Column(Text, nullable=False)
    original_name = Column(Text)
    file_size_bytes = Column(BigInteger, default=0)
    width = Column(Integer)
    height = Column(Integer)
    caption = Column(Text)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    library = relationship("ServicePhotoLibrary", back_populates="photos")
