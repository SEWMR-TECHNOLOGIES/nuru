from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Community Tables
# ──────────────────────────────────────────────

class Community(Base):
    __tablename__ = 'communities'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False)
    description = Column(Text)
    cover_image_url = Column(Text)
    is_public = Column(Boolean, default=True)
    member_count = Column(Integer, default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", back_populates="created_communities")
    members = relationship("CommunityMember", back_populates="community")


class CommunityMember(Base):
    __tablename__ = 'community_members'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    community_id = Column(UUID(as_uuid=True), ForeignKey('communities.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    role = Column(Text, default='member')
    joined_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('community_id', 'user_id', name='uq_community_member'),
    )

    # Relationships
    community = relationship("Community", back_populates="members")
    user = relationship("User", back_populates="community_memberships")
