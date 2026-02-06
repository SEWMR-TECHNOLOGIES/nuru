# models/feeds.py
from sqlalchemy import Column, Text, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from core.base import Base

class UserFeed(Base):
    __tablename__ = 'user_feeds'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    title = Column(Text)
    content = Column(Text)
    location = Column(Text)
    is_public = Column(Boolean, default=True)
    allow_echo = Column(Boolean, default=True)
    glow_count = Column(Integer, default=0)
    echo_count = Column(Integer, default=0)
    spark_count = Column(Integer, default=0)
    video_url = Column(Text)
    video_thumbnail_url = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserFeedImage(Base):
    __tablename__ = 'user_feed_images'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'))
    image_url = Column(Text, nullable=False)
    description = Column(Text)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserFeedGlow(Base):
    __tablename__ = 'user_feed_glows'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    created_at = Column(DateTime, server_default=func.now())

class UserFeedEcho(Base):
    __tablename__ = 'user_feed_echoes'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserFeedSpark(Base):
    __tablename__ = 'user_feed_sparks'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'))
    shared_by_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    platform = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class UserFeedComment(Base):
    __tablename__ = 'user_feed_comments'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    feed_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey('user_feed_comments.id', ondelete='CASCADE'))
    content = Column(Text, nullable=False)
    glow_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    is_edited = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class UserFeedCommentGlow(Base):
    __tablename__ = 'user_feed_comment_glows'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    comment_id = Column(UUID(as_uuid=True), ForeignKey('user_feed_comments.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class UserFeedPinned(Base):
    __tablename__ = 'user_feed_pinned'
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    feed_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'), nullable=False)
    display_order = Column(Integer, default=0)
    pinned_at = Column(DateTime, server_default=func.now())
