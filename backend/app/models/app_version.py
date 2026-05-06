from sqlalchemy import Column, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.base import Base


class AppVersionSetting(Base):
    """Per-platform app version configuration for force-update prompts."""
    __tablename__ = 'app_version_settings'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    platform = Column(Text, nullable=False, unique=True)  # 'android' | 'ios'
    latest_version = Column(Text, nullable=False, default='1.0.0')
    latest_build = Column(Integer, nullable=False, default=1)
    min_supported_build = Column(Integer, nullable=False, default=1)
    force_update = Column(Boolean, nullable=False, default=False)
    update_url = Column(Text)
    message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
