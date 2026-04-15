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
    posts = relationship("CommunityPost", back_populates="community")


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


class CommunityPost(Base):
    __tablename__ = 'community_posts'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    community_id = Column(UUID(as_uuid=True), ForeignKey('communities.id', ondelete='CASCADE'), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    community = relationship("Community", back_populates="posts")
    author = relationship("User")
    images = relationship("CommunityPostImage", back_populates="community_post", foreign_keys="CommunityPostImage.post_id")
    glows = relationship("CommunityPostGlow", back_populates="community_post", foreign_keys="CommunityPostGlow.post_id")


class CommunityPostImage(Base):
    __tablename__ = 'community_post_images'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    post_id = Column(UUID(as_uuid=True), ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    image_url = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    community_post = relationship("CommunityPost", back_populates="images")


class CommunityPostGlow(Base):
    __tablename__ = 'community_post_glows'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    post_id = Column(UUID(as_uuid=True), ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_community_post_glow'),
    )

    # Relationships
    community_post = relationship("CommunityPost", back_populates="glows")
    user = relationship("User")
