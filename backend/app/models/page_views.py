from sqlalchemy import Column, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.base import Base


class PageView(Base):
    __tablename__ = 'page_views'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    path = Column(Text, nullable=False)
    referrer = Column(Text)
    user_agent = Column(Text)
    country = Column(Text)
    city = Column(Text)
    device_type = Column(Text)
    browser = Column(Text)
    session_id = Column(Text)
    visitor_id = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
