# models/communities.py
# Contains community and community member models

from sqlalchemy import Column, Text, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.base import Base

class Community(Base):
    __tablename__ = 'communities'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False)
    description = Column(Text)
    cover_image_url = Column(Text)
    is_public = Column(Boolean, default=True)
    member_count = Column(Integer, default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    members = relationship("CommunityMember", back_populates="community")
    creator = relationship("User", backref="created_communities")


class CommunityMember(Base):
    __tablename__ = 'community_members'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    community_id = Column(UUID(as_uuid=True), ForeignKey('communities.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = Column(Text, default='member')
    joined_at = Column(DateTime, default=func.now())

    community = relationship("Community", back_populates="members")
    user = relationship("User", backref="communities")
