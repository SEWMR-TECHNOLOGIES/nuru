# models/feed_ranking.py
# Data models for the intelligent feed ranking system

from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, Float, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Interaction Tracking
# ──────────────────────────────────────────────

class UserInteractionLog(Base):
    """
    Logs every user interaction with feed content.
    Used as raw signal for ranking model training and real-time feature updates.
    
    interaction_type values:
      - view         : user scrolled past the post (viewport intersection)
      - dwell        : user spent >3s viewing the post
      - glow         : user liked the post
      - unglow       : user unliked the post
      - comment      : user commented on the post
      - echo         : user reposted
      - spark        : user shared externally
      - save         : user bookmarked
      - unsave       : user removed bookmark
      - click_image  : user tapped/clicked an image
      - click_profile: user navigated to post author's profile
      - hide         : user chose to hide the post
      - report       : user reported the post
      - expand       : user expanded truncated text
    """
    __tablename__ = 'user_interaction_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'), nullable=False)
    interaction_type = Column(Text, nullable=False)
    dwell_time_ms = Column(Integer)           # milliseconds user spent viewing (for dwell events)
    session_id = Column(Text)                 # groups interactions within one feed session
    device_type = Column(Text)                # mobile, desktop, tablet
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_interaction_user_post', 'user_id', 'post_id'),
        Index('idx_interaction_user_type', 'user_id', 'interaction_type'),
        Index('idx_interaction_created', 'created_at'),
    )


class UserInterestProfile(Base):
    """
    Stores per-user interest vectors, updated after each interaction.
    
    interest_vector example:
    {
        "wedding": 0.82,
        "birthday": 0.45,
        "memorial": 0.12,
        "corporate_event": 0.60,
        "graduation": 0.33,
        "baby_shower": 0.15,
        "general": 0.50
    }
    
    engagement_stats example:
    {
        "total_glows": 142,
        "total_comments": 38,
        "total_shares": 12,
        "total_dwell_ms": 892000,
        "avg_session_posts_viewed": 15,
        "active_days_last_30": 22,
        "preferred_time_hours": [8, 12, 19, 20, 21]
    }
    """
    __tablename__ = 'user_interest_profiles'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    interest_vector = Column(JSONB, server_default="'{}'::jsonb")
    engagement_stats = Column(JSONB, server_default="'{}'::jsonb")
    negative_signals = Column(JSONB, server_default="'{}'::jsonb")  # hidden authors, categories, etc.
    last_computed_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AuthorAffinityScore(Base):
    """
    Precomputed relationship strength between viewer and author.
    Updated incrementally on each interaction.
    
    Score components:
      - interaction_count: raw count of interactions with this author's posts
      - weighted_score: time-decayed weighted sum of interactions
      - is_following: whether viewer follows this author
      - shared_events: number of events both participated in
      - circle_member: whether author is in viewer's circle
    """
    __tablename__ = 'author_affinity_scores'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    viewer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    interaction_count = Column(Integer, default=0)
    weighted_score = Column(Float, default=0.0)
    is_following = Column(Boolean, default=False)
    shared_events_count = Column(Integer, default=0)
    is_circle_member = Column(Boolean, default=False)
    last_interaction_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_affinity_viewer_author', 'viewer_id', 'author_id', unique=True),
        Index('idx_affinity_viewer', 'viewer_id'),
    )


class PostQualityScore(Base):
    """
    Cached quality score for each post, recomputed periodically.
    
    Factors:
      - engagement_velocity: rate of engagements per hour since creation
      - content_richness: score based on text length, images, media
      - author_credibility: based on author's overall engagement history
      - moderation_flag: True if flagged by moderation (suppresses ranking)
      - spam_probability: 0.0-1.0 spam likelihood
      - final_quality_score: composite quality metric
    """
    __tablename__ = 'post_quality_scores'

    post_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'), primary_key=True)
    engagement_velocity = Column(Float, default=0.0)
    content_richness = Column(Float, default=0.0)
    author_credibility = Column(Float, default=0.5)
    moderation_flag = Column(Boolean, default=False)
    spam_probability = Column(Float, default=0.0)
    category = Column(Text, default='general')  # wedding, birthday, memorial, corporate, graduation, etc.
    final_quality_score = Column(Float, default=0.5)
    total_engagements = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)  # engagements / impressions
    impression_count = Column(Integer, default=0)
    last_computed_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FeedImpression(Base):
    """
    Tracks which posts were shown to which users and in what position.
    Used for:
      - Deduplication (don't show same post twice in session)
      - Position bias correction in engagement prediction
      - CTR / engagement rate computation
    """
    __tablename__ = 'feed_impressions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey('user_feeds.id', ondelete='CASCADE'), nullable=False)
    position = Column(Integer)                # 0-indexed position in the feed
    session_id = Column(Text)
    was_engaged = Column(Boolean, default=False)  # updated async after interaction
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_impression_user_session', 'user_id', 'session_id'),
        Index('idx_impression_post', 'post_id'),
        Index('idx_impression_created', 'created_at'),
    )
