"""
Feed Ranking Service
====================

Production-grade feed ranking system for Nuru.

Architecture:
  1. Candidate Generation  → Pool of ~500-2000 eligible posts
  2. Feature Engineering   → Compute user, post, and context features
  3. Scoring               → Multi-factor weighted scoring
  4. Re-ranking            → Diversity enforcement + exploration injection
  5. Pagination            → Slice ranked results for the requested page

Scoring Formula:
  FinalScore = W1 × EngagementPrediction
             + W2 × RelationshipStrength
             + W3 × InterestMatch
             + W4 × RecencyDecay
             + W5 × ContentQuality
             + W6 × DiversityPenalty
             + W7 × ExplorationBoost

Time Complexity: O(N log N) where N = candidate pool size
Target Latency: <200ms for feed generation
"""

import math
import random
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

import pytz
from sqlalchemy import func as sa_func, or_, and_, desc
from sqlalchemy.orm import Session

from models import (
    UserFeed, UserFeedImage, UserFeedGlow, UserFeedEcho,
    UserFeedSpark, UserFeedComment, UserFeedPinned, UserFeedSaved,
    User, UserProfile, UserFollower, UserCircle,
    EventAttendee, Event, FeedVisibilityEnum,
)
from models.feed_ranking import (
    UserInteractionLog, UserInterestProfile, AuthorAffinityScore,
    PostQualityScore, FeedImpression,
)

EAT = pytz.timezone("Africa/Nairobi")

# ──────────────────────────────────────────────
# Scoring Weights (tunable)
# ──────────────────────────────────────────────

WEIGHTS = {
    "engagement_prediction": 0.25,   # W1
    "relationship_strength": 0.22,   # W2
    "interest_match": 0.18,          # W3
    "recency_decay": 0.15,           # W4
    "content_quality": 0.10,         # W5
    "diversity_penalty": -0.05,      # W6 (negative = penalize)
    "exploration_boost": 0.05,       # W7
}

# Recency decay parameter (higher = faster decay)
LAMBDA_DECAY = 0.04  # ~50% score at 17 hours, ~25% at 35 hours

# Candidate pool limits
MAX_CANDIDATES = 1500
MIN_CANDIDATES = 50

# Diversity parameters
MAX_SAME_AUTHOR_IN_WINDOW = 2
DIVERSITY_WINDOW_SIZE = 10
MAX_SAME_CATEGORY_IN_WINDOW = 4

# Exploration parameters
EXPLORATION_RATE = 0.08  # 8% of feed slots reserved for exploration

# Category detection keywords
CATEGORY_KEYWORDS = {
    "wedding": ["wedding", "bride", "groom", "ceremony", "reception", "ndoa", "harusi"],
    "birthday": ["birthday", "bday", "turns", "cake", "siku ya kuzaliwa", "birthday party"],
    "memorial": ["memorial", "remembrance", "rip", "rest in peace", "tribute", "condolence", "rambirambi"],
    "graduation": ["graduation", "graduate", "diploma", "degree", "convocation", "mahafali"],
    "baby_shower": ["baby shower", "expecting", "baby", "shower", "mama-to-be"],
    "corporate_event": ["corporate", "conference", "seminar", "workshop", "launch", "business", "summit"],
    "fundraiser": ["fundraiser", "harambee", "charity", "donation", "fundraising"],
    "cultural": ["cultural", "traditional", "ceremony", "heritage", "utamaduni"],
}

DEFAULT_INTEREST_VECTOR = {
    "wedding": 0.5,
    "birthday": 0.5,
    "memorial": 0.3,
    "graduation": 0.4,
    "baby_shower": 0.3,
    "corporate_event": 0.4,
    "fundraiser": 0.3,
    "cultural": 0.3,
    "general": 0.5,
}


# ──────────────────────────────────────────────
# Category Detection
# ──────────────────────────────────────────────

def detect_category(text: str) -> str:
    """Detect post category from text content using keyword matching."""
    if not text:
        return "general"
    text_lower = text.lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[cat] = score
    if scores:
        return max(scores, key=scores.get)
    return "general"


# ──────────────────────────────────────────────
# Candidate Generation
# ──────────────────────────────────────────────

def generate_candidates(
    db: Session,
    current_user_id: uuid.UUID,
    max_age_hours: int = 168,  # 7 days
) -> List[UserFeed]:
    """
    Generate candidate pool from multiple sources:
    1. Posts from users the viewer follows
    2. Posts from users in their circles
    3. Posts from shared event participants
    4. Trending posts (high engagement, recent)
    5. High-quality posts from broader platform
    
    Returns deduplicated pool of up to MAX_CANDIDATES posts.
    """
    cutoff = datetime.now(EAT) - timedelta(hours=max_age_hours)
    cutoff_naive = cutoff.replace(tzinfo=None)
    
    candidate_ids = set()
    candidates = []
    
    def _add_candidates(posts):
        for p in posts:
            pid = str(p.id)
            if pid not in candidate_ids:
                candidate_ids.add(pid)
                candidates.append(p)
    
    # ── Source 1: Posts from followed users ──
    following_ids = [
        r[0] for r in db.query(UserFollower.following_id)
        .filter(UserFollower.follower_id == current_user_id).all()
    ]
    
    if following_ids:
        following_posts = (
            db.query(UserFeed)
            .filter(
                UserFeed.user_id.in_(following_ids),
                UserFeed.is_active == True,
                UserFeed.created_at >= cutoff_naive,
                or_(
                    UserFeed.visibility == FeedVisibilityEnum.public,
                    UserFeed.visibility.is_(None),
                ),
            )
            .order_by(desc(UserFeed.created_at))
            .limit(500)
            .all()
        )
        _add_candidates(following_posts)
    
    # ── Source 2: Posts from circle members ──
    circle_author_ids = [
        r[0] for r in db.query(UserCircle.user_id)
        .filter(UserCircle.circle_member_id == current_user_id).all()
    ]
    # Users I added to my circle
    my_circle_ids = [
        r[0] for r in db.query(UserCircle.circle_member_id)
        .filter(UserCircle.user_id == current_user_id).all()
    ]
    all_circle_ids = list(set(circle_author_ids + my_circle_ids))
    
    if all_circle_ids:
        circle_posts = (
            db.query(UserFeed)
            .filter(
                UserFeed.user_id.in_(all_circle_ids),
                UserFeed.is_active == True,
                UserFeed.created_at >= cutoff_naive,
            )
            .order_by(desc(UserFeed.created_at))
            .limit(300)
            .all()
        )
        _add_candidates(circle_posts)
    
    # ── Source 3: Posts from shared event participants ──
    # Find events user is attending
    user_event_ids = [
        r[0] for r in db.query(EventAttendee.event_id)
        .filter(EventAttendee.attendee_id == current_user_id).all()
    ]
    # Also events user is organizing
    organizer_event_ids = [
        r[0] for r in db.query(Event.id)
        .filter(Event.organizer_id == current_user_id).all()
    ]
    all_event_ids = list(set(user_event_ids + organizer_event_ids))
    
    if all_event_ids:
        # Find other participants
        co_participant_ids = [
            r[0] for r in db.query(EventAttendee.attendee_id)
            .filter(
                EventAttendee.event_id.in_(all_event_ids),
                EventAttendee.attendee_id != current_user_id,
            ).distinct().all()
        ]
        co_organizer_ids = [
            r[0] for r in db.query(Event.organizer_id)
            .filter(
                Event.id.in_(all_event_ids),
                Event.organizer_id != current_user_id,
            ).distinct().all()
        ]
        event_user_ids = list(set(co_participant_ids + co_organizer_ids))
        
        if event_user_ids:
            event_posts = (
                db.query(UserFeed)
                .filter(
                    UserFeed.user_id.in_(event_user_ids[:200]),
                    UserFeed.is_active == True,
                    UserFeed.created_at >= cutoff_naive,
                    or_(
                        UserFeed.visibility == FeedVisibilityEnum.public,
                        UserFeed.visibility.is_(None),
                    ),
                )
                .order_by(desc(UserFeed.created_at))
                .limit(200)
                .all()
            )
            _add_candidates(event_posts)
    
    # ── Source 4: Own posts (always included) ──
    own_posts = (
        db.query(UserFeed)
        .filter(
            UserFeed.user_id == current_user_id,
            UserFeed.is_active == True,
            UserFeed.created_at >= cutoff_naive,
        )
        .order_by(desc(UserFeed.created_at))
        .limit(50)
        .all()
    )
    _add_candidates(own_posts)
    
    # ── Source 5: Trending / high-quality posts platform-wide ──
    if len(candidates) < MAX_CANDIDATES:
        remaining = MAX_CANDIDATES - len(candidates)
        # Posts with high engagement, excluding already collected
        trending_posts = (
            db.query(UserFeed)
            .filter(
                UserFeed.is_active == True,
                UserFeed.created_at >= cutoff_naive,
                or_(
                    UserFeed.visibility == FeedVisibilityEnum.public,
                    UserFeed.visibility.is_(None),
                ),
                ~UserFeed.id.in_([uuid.UUID(pid) for pid in candidate_ids]) if candidate_ids else True,
            )
            .order_by(desc(UserFeed.glow_count + UserFeed.echo_count))
            .limit(min(remaining, 500))
            .all()
        )
        _add_candidates(trending_posts)
    
    return candidates[:MAX_CANDIDATES]


# ──────────────────────────────────────────────
# Feature Computation
# ──────────────────────────────────────────────

def compute_post_features(
    db: Session,
    post: UserFeed,
    current_user_id: uuid.UUID,
    user_interest: Dict[str, float],
    affinity_cache: Dict[str, float],
    quality_cache: Dict[str, PostQualityScore],
    now: datetime,
) -> Dict[str, float]:
    """
    Compute all ranking features for a single post.
    Returns feature dict ready for scoring.
    """
    post_id_str = str(post.id)
    author_id_str = str(post.user_id)
    
    # ── 1. Recency Decay ──
    age_hours = max(0.1, (now - post.created_at).total_seconds() / 3600) if post.created_at else 168
    recency_score = math.exp(-LAMBDA_DECAY * age_hours)
    
    # ── 2. Relationship Strength ──
    relationship_score = affinity_cache.get(author_id_str, 0.0)
    # Boost own posts
    if str(post.user_id) == str(current_user_id):
        relationship_score = max(relationship_score, 0.3)
    
    # ── 3. Interest Match ──
    category = detect_category(post.content or "")
    interest_score = user_interest.get(category, user_interest.get("general", 0.5))
    
    # ── 4. Content Quality ──
    quality = quality_cache.get(post_id_str)
    if quality:
        quality_score = quality.final_quality_score
        # Suppress moderated/spam content
        if quality.moderation_flag:
            quality_score *= 0.1
        if quality.spam_probability > 0.5:
            quality_score *= (1.0 - quality.spam_probability)
    else:
        # Compute inline for uncached posts
        quality_score = _compute_inline_quality(db, post)
    
    # ── 5. Engagement Prediction ──
    # Lightweight heuristic model: combine engagement signals
    glow_count = post.glow_count or 0
    echo_count = post.echo_count or 0
    spark_count = post.spark_count or 0
    
    # Engagement velocity (engagements per hour)
    if age_hours > 0:
        velocity = (glow_count * 1.0 + echo_count * 2.0 + spark_count * 3.0) / age_hours
    else:
        velocity = 0
    
    # Normalize to 0-1 range (sigmoid-like)
    engagement_prediction = 1.0 / (1.0 + math.exp(-0.5 * (velocity - 2.0)))
    
    # Boost if user has historically engaged with similar content
    engagement_prediction = min(1.0, engagement_prediction * (1.0 + interest_score * 0.3))
    
    # ── 6. Exploration Boost ──
    # Deterministic but user-specific randomness using hash
    exploration_seed = hashlib.md5(f"{current_user_id}:{post_id_str}:{now.date()}".encode()).hexdigest()
    exploration_value = int(exploration_seed[:8], 16) / 0xFFFFFFFF
    exploration_boost = 1.0 if exploration_value < EXPLORATION_RATE else 0.0
    
    return {
        "engagement_prediction": engagement_prediction,
        "relationship_strength": relationship_score,
        "interest_match": interest_score,
        "recency_decay": recency_score,
        "content_quality": quality_score,
        "exploration_boost": exploration_boost,
        "category": category,
        "author_id": author_id_str,
        "age_hours": age_hours,
    }


def _compute_inline_quality(db: Session, post: UserFeed) -> float:
    """Compute quality score inline when no cached score exists."""
    score = 0.5  # base
    
    # Text richness
    text_len = len(post.content or "")
    if text_len > 50:
        score += 0.1
    if text_len > 200:
        score += 0.05
    
    # Has images
    image_count = db.query(sa_func.count(UserFeedImage.id)).filter(
        UserFeedImage.feed_id == post.id
    ).scalar() or 0
    if image_count > 0:
        score += 0.15
    if image_count > 1:
        score += 0.05
    
    # Has video
    if post.video_url:
        score += 0.1
    
    # Engagement signals
    glow_count = post.glow_count or 0
    echo_count = post.echo_count or 0
    if glow_count > 5:
        score += 0.05
    if echo_count > 2:
        score += 0.05
    
    return min(1.0, score)


# ──────────────────────────────────────────────
# Scoring
# ──────────────────────────────────────────────

def compute_final_score(features: Dict[str, float]) -> float:
    """
    Compute the final ranking score using the multi-factor formula:
    
    FinalScore = W1 × EngagementPrediction
               + W2 × RelationshipStrength
               + W3 × InterestMatch
               + W4 × RecencyDecay
               + W5 × ContentQuality
               + W6 × DiversityPenalty (applied later)
               + W7 × ExplorationBoost
    """
    score = (
        WEIGHTS["engagement_prediction"] * features["engagement_prediction"]
        + WEIGHTS["relationship_strength"] * features["relationship_strength"]
        + WEIGHTS["interest_match"] * features["interest_match"]
        + WEIGHTS["recency_decay"] * features["recency_decay"]
        + WEIGHTS["content_quality"] * features["content_quality"]
        + WEIGHTS["exploration_boost"] * features["exploration_boost"]
    )
    return score


# ──────────────────────────────────────────────
# Diversity Re-Ranking
# ──────────────────────────────────────────────

def apply_diversity_reranking(
    scored_posts: List[Tuple[UserFeed, float, Dict[str, float]]]
) -> List[Tuple[UserFeed, float, Dict[str, float]]]:
    """
    Apply diversity constraints to prevent monotonous feeds:
    1. Max N posts from same author in a sliding window
    2. Max M posts from same category in a sliding window
    3. Inject exploration slots
    
    Uses a greedy approach: iterate through scored list and enforce constraints.
    """
    reranked = []
    deferred = []
    
    for post, score, features in scored_posts:
        author_id = features["author_id"]
        category = features["category"]
        
        # Check window constraints
        window = reranked[-DIVERSITY_WINDOW_SIZE:]
        author_count = sum(1 for _, _, f in window if f["author_id"] == author_id)
        category_count = sum(1 for _, _, f in window if f["category"] == category)
        
        if author_count >= MAX_SAME_AUTHOR_IN_WINDOW:
            # Apply diversity penalty and defer
            penalized_score = score + WEIGHTS["diversity_penalty"] * 0.5
            deferred.append((post, penalized_score, features))
            continue
        
        if category_count >= MAX_SAME_CATEGORY_IN_WINDOW:
            penalized_score = score + WEIGHTS["diversity_penalty"] * 0.3
            deferred.append((post, penalized_score, features))
            continue
        
        reranked.append((post, score, features))
    
    # Re-insert deferred posts at appropriate positions
    for item in sorted(deferred, key=lambda x: -x[1]):
        # Find best insertion point
        inserted = False
        for i in range(len(reranked)):
            if reranked[i][1] < item[1]:
                reranked.insert(i, item)
                inserted = True
                break
        if not inserted:
            reranked.append(item)
    
    return reranked


# ──────────────────────────────────────────────
# Main Feed Generation
# ──────────────────────────────────────────────

def generate_ranked_feed(
    db: Session,
    current_user_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    session_id: Optional[str] = None,
) -> Tuple[List[UserFeed], Dict]:
    """
    Main entry point: generates a ranked, personalized feed.
    
    Steps:
    1. Generate candidate pool
    2. Load user interest profile & affinity scores
    3. Score all candidates
    4. Apply diversity re-ranking
    5. Paginate and return
    6. Log impressions asynchronously
    
    Returns: (posts, pagination_dict)
    """
    now = datetime.now(EAT).replace(tzinfo=None)
    
    # ── Step 1: Candidate Generation ──
    candidates = generate_candidates(db, current_user_id)
    
    if not candidates:
        return [], {
            "page": page, "limit": limit,
            "total_items": 0, "total_pages": 1,
            "has_next": False, "has_previous": False,
        }
    
    # ── Step 2: Load User Context ──
    # Interest profile
    interest_profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == current_user_id
    ).first()
    user_interest = (
        interest_profile.interest_vector 
        if interest_profile and interest_profile.interest_vector 
        else DEFAULT_INTEREST_VECTOR.copy()
    )
    
    # Affinity scores (batch load)
    affinity_rows = db.query(AuthorAffinityScore).filter(
        AuthorAffinityScore.viewer_id == current_user_id
    ).all()
    affinity_cache = {str(a.author_id): a.weighted_score for a in affinity_rows}
    
    # Enrich affinity with follow status for authors not yet in cache
    following_set = set(
        str(r[0]) for r in db.query(UserFollower.following_id)
        .filter(UserFollower.follower_id == current_user_id).all()
    )
    for author_id_str in set(str(c.user_id) for c in candidates):
        if author_id_str not in affinity_cache:
            base = 0.0
            if author_id_str in following_set:
                base = 0.4
            affinity_cache[author_id_str] = base
        elif author_id_str in following_set:
            affinity_cache[author_id_str] = max(affinity_cache[author_id_str], 0.4)
    
    # Quality scores (batch load)
    candidate_ids = [c.id for c in candidates]
    quality_rows = db.query(PostQualityScore).filter(
        PostQualityScore.post_id.in_(candidate_ids)
    ).all()
    quality_cache = {str(q.post_id): q for q in quality_rows}
    
    # ── Step 3: Score All Candidates ──
    scored = []
    for post in candidates:
        features = compute_post_features(
            db, post, current_user_id,
            user_interest, affinity_cache, quality_cache, now,
        )
        score = compute_final_score(features)
        scored.append((post, score, features))
    
    # Sort by score descending
    scored.sort(key=lambda x: -x[1])
    
    # ── Step 4: Diversity Re-Ranking ──
    scored = apply_diversity_reranking(scored)
    
    # ── Step 5: Paginate ──
    total_items = len(scored)
    total_pages = max(1, math.ceil(total_items / limit))
    page = max(1, min(page, total_pages))
    
    start = (page - 1) * limit
    end = start + limit
    page_items = scored[start:end]
    
    pagination = {
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }
    
    # ── Step 6: Log Impressions (best-effort) ──
    try:
        for idx, (post, score, features) in enumerate(page_items):
            impression = FeedImpression(
                user_id=current_user_id,
                post_id=post.id,
                position=start + idx,
                session_id=session_id,
            )
            db.add(impression)
        db.commit()
    except Exception:
        db.rollback()
    
    return [p for p, _, _ in page_items], pagination


# ──────────────────────────────────────────────
# Interaction Tracking & Profile Updates
# ──────────────────────────────────────────────

# Interaction weights for interest/affinity updates
INTERACTION_WEIGHTS = {
    "view": 0.1,
    "dwell": 0.3,
    "glow": 1.0,
    "comment": 1.5,
    "echo": 2.0,
    "spark": 2.5,
    "save": 1.2,
    "click_image": 0.4,
    "click_profile": 0.6,
    "expand": 0.3,
    "hide": -2.0,
    "report": -5.0,
    "unglow": -0.5,
    "unsave": -0.3,
}


def log_interaction(
    db: Session,
    user_id: uuid.UUID,
    post_id: uuid.UUID,
    interaction_type: str,
    dwell_time_ms: Optional[int] = None,
    session_id: Optional[str] = None,
    device_type: Optional[str] = None,
) -> bool:
    """
    Log a user interaction and trigger incremental updates to:
    1. UserInteractionLog (raw log)
    2. UserInterestProfile (interest vector update)
    3. AuthorAffinityScore (relationship strength update)
    4. PostQualityScore (engagement metrics update)
    5. FeedImpression.was_engaged (mark impression as engaged)
    """
    # Validate interaction type
    if interaction_type not in INTERACTION_WEIGHTS:
        return False
    
    # ── 1. Log the raw interaction ──
    log_entry = UserInteractionLog(
        user_id=user_id,
        post_id=post_id,
        interaction_type=interaction_type,
        dwell_time_ms=dwell_time_ms,
        session_id=session_id,
        device_type=device_type,
    )
    db.add(log_entry)
    
    # ── 2. Get post details for category ──
    post = db.query(UserFeed).filter(UserFeed.id == post_id).first()
    if not post:
        db.commit()
        return True
    
    author_id = post.user_id
    category = detect_category(post.content or "")
    weight = INTERACTION_WEIGHTS[interaction_type]
    
    # ── 3. Update Interest Profile ──
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()
    
    if not profile:
        profile = UserInterestProfile(
            user_id=user_id,
            interest_vector=DEFAULT_INTEREST_VECTOR.copy(),
            engagement_stats={},
            negative_signals={},
        )
        db.add(profile)
        db.flush()
    
    # Exponential moving average update
    interest_vec = profile.interest_vector or DEFAULT_INTEREST_VECTOR.copy()
    alpha = 0.05  # Learning rate
    current_val = interest_vec.get(category, 0.5)
    
    if weight > 0:
        # Positive interaction: move toward 1.0
        new_val = current_val + alpha * weight * (1.0 - current_val)
    else:
        # Negative interaction: move toward 0.0
        new_val = current_val + alpha * weight * current_val
    
    interest_vec[category] = max(0.0, min(1.0, new_val))
    profile.interest_vector = interest_vec
    profile.updated_at = datetime.utcnow()
    
    # Update engagement stats
    stats = profile.engagement_stats or {}
    key = f"total_{interaction_type}s"
    stats[key] = stats.get(key, 0) + 1
    if dwell_time_ms and interaction_type == "dwell":
        stats["total_dwell_ms"] = stats.get("total_dwell_ms", 0) + dwell_time_ms
    profile.engagement_stats = stats
    
    # Update negative signals
    if interaction_type in ("hide", "report"):
        neg = profile.negative_signals or {}
        hidden_authors = neg.get("hidden_authors", [])
        if str(author_id) not in hidden_authors:
            hidden_authors.append(str(author_id))
        neg["hidden_authors"] = hidden_authors[-100:]  # Keep last 100
        profile.negative_signals = neg
    
    # ── 4. Update Author Affinity ──
    affinity = db.query(AuthorAffinityScore).filter(
        AuthorAffinityScore.viewer_id == user_id,
        AuthorAffinityScore.author_id == author_id,
    ).first()
    
    if not affinity:
        is_following = db.query(UserFollower).filter(
            UserFollower.follower_id == user_id,
            UserFollower.following_id == author_id,
        ).first() is not None
        
        is_circle = db.query(UserCircle).filter(
            or_(
                and_(UserCircle.user_id == user_id, UserCircle.circle_member_id == author_id),
                and_(UserCircle.user_id == author_id, UserCircle.circle_member_id == user_id),
            )
        ).first() is not None
        
        affinity = AuthorAffinityScore(
            viewer_id=user_id,
            author_id=author_id,
            interaction_count=0,
            weighted_score=0.4 if is_following else 0.0,
            is_following=is_following,
            is_circle_member=is_circle,
        )
        db.add(affinity)
        db.flush()
    
    # Increment interaction count
    if weight > 0:
        affinity.interaction_count = (affinity.interaction_count or 0) + 1
    
    # Update weighted score with time-decayed contribution
    decay_factor = 0.95  # Slow decay for affinity
    old_score = affinity.weighted_score or 0.0
    contribution = weight * 0.1  # Scale down
    affinity.weighted_score = min(1.0, max(0.0, old_score * decay_factor + contribution))
    affinity.last_interaction_at = datetime.utcnow()
    affinity.updated_at = datetime.utcnow()
    
    # ── 5. Update Post Quality Score ──
    quality = db.query(PostQualityScore).filter(
        PostQualityScore.post_id == post_id
    ).first()
    
    if quality:
        if weight > 0:
            quality.total_engagements = (quality.total_engagements or 0) + 1
        quality.impression_count = (quality.impression_count or 0) + (1 if interaction_type == "view" else 0)
        if quality.impression_count > 0:
            quality.engagement_rate = quality.total_engagements / quality.impression_count
        
        # Recompute velocity
        age_hours = max(0.1, (datetime.utcnow() - post.created_at).total_seconds() / 3600) if post.created_at else 1
        quality.engagement_velocity = quality.total_engagements / age_hours
        quality.updated_at = datetime.utcnow()
    
    # ── 6. Mark impression as engaged ──
    if interaction_type not in ("view",):
        recent_impression = db.query(FeedImpression).filter(
            FeedImpression.user_id == user_id,
            FeedImpression.post_id == post_id,
        ).order_by(desc(FeedImpression.created_at)).first()
        
        if recent_impression:
            recent_impression.was_engaged = True
    
    try:
        db.commit()
    except Exception:
        db.rollback()
    
    return True


# ──────────────────────────────────────────────
# Quality Score Recomputation (Batch)
# ──────────────────────────────────────────────

def recompute_quality_scores(db: Session, max_posts: int = 1000):
    """
    Batch recompute quality scores for recent posts.
    Called periodically (e.g., every 30 minutes via background task).
    """
    cutoff = datetime.utcnow() - timedelta(hours=168)  # 7 days
    
    posts = (
        db.query(UserFeed)
        .filter(UserFeed.is_active == True, UserFeed.created_at >= cutoff)
        .order_by(desc(UserFeed.created_at))
        .limit(max_posts)
        .all()
    )
    
    for post in posts:
        quality = db.query(PostQualityScore).filter(
            PostQualityScore.post_id == post.id
        ).first()
        
        if not quality:
            quality = PostQualityScore(post_id=post.id)
            db.add(quality)
        
        # Content richness
        richness = 0.3
        text_len = len(post.content or "")
        if text_len > 50: richness += 0.15
        if text_len > 200: richness += 0.1
        
        img_count = db.query(sa_func.count(UserFeedImage.id)).filter(
            UserFeedImage.feed_id == post.id
        ).scalar() or 0
        if img_count > 0: richness += 0.2
        if img_count > 1: richness += 0.1
        if post.video_url: richness += 0.15
        quality.content_richness = min(1.0, richness)
        
        # Engagement metrics
        glow_count = db.query(sa_func.count(UserFeedGlow.id)).filter(
            UserFeedGlow.feed_id == post.id).scalar() or 0
        echo_count = db.query(sa_func.count(UserFeedEcho.id)).filter(
            UserFeedEcho.feed_id == post.id).scalar() or 0
        comment_count = db.query(sa_func.count(UserFeedComment.id)).filter(
            UserFeedComment.feed_id == post.id, UserFeedComment.is_active == True
        ).scalar() or 0
        
        total = glow_count + echo_count * 2 + comment_count * 1.5
        quality.total_engagements = int(total)
        
        age_hours = max(0.1, (datetime.utcnow() - post.created_at).total_seconds() / 3600) if post.created_at else 1
        quality.engagement_velocity = total / age_hours
        
        # Author credibility
        author_total_glows = db.query(sa_func.count(UserFeedGlow.id)).join(
            UserFeed, UserFeedGlow.feed_id == UserFeed.id
        ).filter(UserFeed.user_id == post.user_id).scalar() or 0
        quality.author_credibility = min(1.0, 0.3 + author_total_glows * 0.01)
        
        # Category
        quality.category = detect_category(post.content or "")
        
        # Final composite
        quality.final_quality_score = min(1.0, (
            quality.content_richness * 0.3
            + quality.author_credibility * 0.3
            + min(1.0, quality.engagement_velocity * 0.1) * 0.4
        ))
        
        quality.last_computed_at = datetime.utcnow()
    
    try:
        db.commit()
    except Exception:
        db.rollback()


# ──────────────────────────────────────────────
# Cold Start Strategy
# ──────────────────────────────────────────────

def get_cold_start_feed(
    db: Session,
    current_user_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[UserFeed], Dict]:
    """
    Feed for new users with no interaction history.
    Strategy:
    1. High-quality recent posts with images (visual appeal)
    2. Posts from popular authors (social proof)
    3. Mix of categories for exploration
    4. Chronological tiebreaker for freshness
    """
    cutoff = datetime.utcnow() - timedelta(hours=72)  # 3 days
    
    # Get posts with images, sorted by engagement
    posts = (
        db.query(UserFeed)
        .filter(
            UserFeed.is_active == True,
            UserFeed.created_at >= cutoff,
            or_(
                UserFeed.visibility == FeedVisibilityEnum.public,
                UserFeed.visibility.is_(None),
            ),
        )
        .order_by(
            desc(UserFeed.glow_count + UserFeed.echo_count),
            desc(UserFeed.created_at),
        )
        .limit(200)
        .all()
    )
    
    # Diversify by category
    categorized = defaultdict(list)
    for p in posts:
        cat = detect_category(p.content or "")
        categorized[cat].append(p)
    
    # Round-robin across categories
    result = []
    seen = set()
    while len(result) < len(posts):
        added = False
        for cat in list(categorized.keys()):
            if categorized[cat]:
                p = categorized[cat].pop(0)
                if str(p.id) not in seen:
                    seen.add(str(p.id))
                    result.append(p)
                    added = True
        if not added:
            break
    
    total_items = len(result)
    total_pages = max(1, math.ceil(total_items / limit))
    page = max(1, min(page, total_pages))
    start = (page - 1) * limit
    page_items = result[start:start + limit]
    
    pagination = {
        "page": page, "limit": limit,
        "total_items": total_items, "total_pages": total_pages,
        "has_next": page < total_pages, "has_previous": page > 1,
    }
    
    return page_items, pagination
