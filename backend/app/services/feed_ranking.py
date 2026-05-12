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

# ──────────────────────────────────────────────
# Impression / fatigue parameters
# Posts the viewer has already seen are softly down-ranked instead of being
# hidden — this prevents the "same content every login" failure mode while
# keeping high-relevance content from disappearing entirely if it still
# matters. After enough unengaged impressions, we hard-skip.
# ──────────────────────────────────────────────
IMPRESSION_LOOKBACK_HOURS = 72            # window we count impressions over
UNENGAGED_PENALTY_K = 0.55                # score *= exp(-K * unengaged_count)
ENGAGED_DAMPENING = 0.20                  # score *= exp(-D * engaged_count)
HARD_SKIP_UNENGAGED_AFTER = 4             # times shown w/o engaging → drop
HARD_SKIP_ENGAGED_AFTER = 8               # times shown w/ engagement → drop

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
# Onboarding interests → internal ranking categories
# Lets the chips a user selects on the onboarding screen actually steer the
# feed (and not just be cosmetic). Multiple onboarding slugs can map to the
# same internal category.
# ──────────────────────────────────────────────
ONBOARDING_TO_INTERNAL = {
    "weddings":        ["wedding"],
    "birthdays":       ["birthday"],
    "graduations":     ["graduation"],
    "anniversaries":   ["wedding", "general"],
    "baby_showers":    ["baby_shower"],
    "private_parties": ["birthday", "general"],
    "concerts":        ["general"],
    "festivals":       ["cultural", "general"],
    "nightlife":       ["general"],
    "conferences":     ["corporate_event"],
    "workshops":       ["corporate_event"],
    "networking":      ["corporate_event"],
    "corporate":       ["corporate_event"],
    "exhibitions":     ["corporate_event", "cultural"],
    "fashion_shows":   ["cultural", "general"],
    "sports_events":   ["general"],
    "faith":           ["cultural", "general"],
    "cultural":        ["cultural"],
    "community":       ["fundraiser", "general"],
    "charity":         ["fundraiser"],
    "food_events":     ["general"],
    "memorials":       ["memorial"],
    "retreats":        ["general"],
}


def blend_onboarding_interests(
    base_vector: Dict[str, float],
    profile_interests: Optional[List[str]],
) -> Dict[str, float]:
    """Boost the interest vector with the user's onboarding picks.

    Picks are treated as strong signals — they pull matching internal
    categories up to at least 0.9 so cold-start and low-interaction users
    immediately see content aligned with what they told us they care about.
    """
    vec = dict(base_vector) if base_vector else DEFAULT_INTEREST_VECTOR.copy()
    if not profile_interests:
        return vec
    for slug in profile_interests:
        for cat in ONBOARDING_TO_INTERNAL.get(str(slug).lower(), []):
            vec[cat] = max(vec.get(cat, 0.0), 0.9)
    return vec


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
        trending_filters = [
            UserFeed.is_active == True,
            UserFeed.created_at >= cutoff_naive,
            or_(
                UserFeed.visibility == FeedVisibilityEnum.public,
                UserFeed.visibility.is_(None),
            ),
        ]
        if candidate_ids:
            try:
                trending_filters.append(
                    ~UserFeed.id.in_([uuid.UUID(pid) for pid in candidate_ids])
                )
            except (ValueError, TypeError):
                pass
        # Engagement velocity (per recent hour), not raw global counters, so
        # mature mega-posts don't dominate everyone's trending bucket. We
        # over-fetch then let downstream scoring + per-user shuffle decide.
        trending_posts = (
            db.query(UserFeed)
            .filter(*trending_filters)
            .order_by(
                desc(
                    (UserFeed.glow_count + UserFeed.echo_count * 2 + UserFeed.spark_count * 3)
                    / sa_func.greatest(
                        sa_func.extract('epoch', sa_func.now() - UserFeed.created_at) / 3600.0,
                        1.0,
                    )
                )
            )
            .limit(min(remaining, 500))
            .all()
        )
        _add_candidates(trending_posts)

    # ── Source 6: Recent organic moments (anti-event-share-bias) ──
    # Pull a pool of recent organic user moments so the feed is never dominated
    # by event_share posts. These get caught by diversity re-ranking later.
    if len(candidates) < MAX_CANDIDATES:
        remaining = MAX_CANDIDATES - len(candidates)
        organic_filters = [
            UserFeed.is_active == True,
            UserFeed.created_at >= cutoff_naive,
            or_(UserFeed.post_type == 'post', UserFeed.post_type.is_(None)),
            or_(
                UserFeed.visibility == FeedVisibilityEnum.public,
                UserFeed.visibility.is_(None),
            ),
        ]
        if candidate_ids:
            try:
                organic_filters.append(
                    ~UserFeed.id.in_([uuid.UUID(pid) for pid in candidate_ids])
                )
            except (ValueError, TypeError):
                pass
        organic_recent = (
            db.query(UserFeed)
            .filter(*organic_filters)
            .order_by(desc(UserFeed.created_at))
            .limit(min(remaining, 400))
            .all()
        )
        _add_candidates(organic_recent)

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
    impression_cache: Optional[Dict[str, Tuple[int, int]]] = None,
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
    # Rotate every 6 hours so even the "exploration" slot doesn't surface the
    # same posts on consecutive logins of the same day.
    rot_bucket = f"{now.date()}:{now.hour // 6}"
    exploration_seed = hashlib.md5(f"{current_user_id}:{post_id_str}:{rot_bucket}".encode()).hexdigest()
    exploration_value = int(exploration_seed[:8], 16) / 0xFFFFFFFF
    exploration_boost = 1.0 if exploration_value < EXPLORATION_RATE else 0.0

    # ── 7. Impression fatigue ──
    # Multiplicative penalty so previously-seen posts decay smoothly. Engaged
    # impressions decay slower than ignored ones, so a post you liked can
    # still come back occasionally, but a post you scrolled past 3× drops fast.
    unengaged, engaged = (0, 0)
    if impression_cache is not None:
        unengaged, engaged = impression_cache.get(post_id_str, (0, 0))
    fatigue_multiplier = math.exp(
        -UNENGAGED_PENALTY_K * unengaged
        -ENGAGED_DAMPENING   * engaged
    )
    
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
        "fatigue_multiplier": fatigue_multiplier,
        "unengaged_views": unengaged,
        "engaged_views": engaged,
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
    base = (
        WEIGHTS["engagement_prediction"] * features["engagement_prediction"]
        + WEIGHTS["relationship_strength"] * features["relationship_strength"]
        + WEIGHTS["interest_match"] * features["interest_match"]
        + WEIGHTS["recency_decay"] * features["recency_decay"]
        + WEIGHTS["content_quality"] * features["content_quality"]
        + WEIGHTS["exploration_boost"] * features["exploration_boost"]
    )
    # Fatigue is multiplicative so saturation behaves naturally.
    return base * features.get("fatigue_multiplier", 1.0)


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
    5. Filter out posts already shown in this session (anti-repetition)
    6. Paginate and return
    7. Log impressions asynchronously
    
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
    # Blend in the user's onboarding interests so the chips they picked at
    # signup actually steer ranking — not just the categories they've already
    # interacted with. Picks raise matching categories to at least 0.9.
    try:
        from models.users import UserProfile
        up = db.query(UserProfile).filter(UserProfile.user_id == current_user_id).first()
        if up and isinstance(up.interests, list) and up.interests:
            user_interest = blend_onboarding_interests(user_interest, up.interests)
    except Exception:
        pass
    
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

    # ── Step 2b: Load impression history (per-post seen / engaged counts) ──
    # One batch query bounded by IMPRESSION_LOOKBACK_HOURS so we never scan
    # the entire history. Drives both the fatigue multiplier and the hard
    # saturation skip below.
    impression_cache: Dict[str, Tuple[int, int]] = {}
    try:
        impression_cutoff = now - timedelta(hours=IMPRESSION_LOOKBACK_HOURS)
        # Two small grouped queries instead of a SUM(CASE) — friendlier
        # across dialects and easy to read. Both are bounded by candidate_ids
        # and the lookback cutoff, so they're cheap.
        total_rows = (
            db.query(FeedImpression.post_id, sa_func.count(FeedImpression.id))
            .filter(
                FeedImpression.user_id == current_user_id,
                FeedImpression.post_id.in_(candidate_ids),
                FeedImpression.created_at >= impression_cutoff,
            )
            .group_by(FeedImpression.post_id)
            .all()
        )
        engaged_rows = (
            db.query(FeedImpression.post_id, sa_func.count(FeedImpression.id))
            .filter(
                FeedImpression.user_id == current_user_id,
                FeedImpression.post_id.in_(candidate_ids),
                FeedImpression.created_at >= impression_cutoff,
                FeedImpression.was_engaged == True,
            )
            .group_by(FeedImpression.post_id)
            .all()
        )
        engaged_map = {str(pid): int(cnt) for pid, cnt in engaged_rows}
        for pid, total in total_rows:
            pid_s = str(pid)
            eng = engaged_map.get(pid_s, 0)
            unengaged = max(0, int(total) - eng)
            impression_cache[pid_s] = (unengaged, eng)
    except Exception:
        impression_cache = {}
    
    # ── Step 3: Score All Candidates ──
    scored = []
    for post in candidates:
        pid_s = str(post.id)
        un, en = impression_cache.get(pid_s, (0, 0))
        # Hard saturation: drop posts the viewer has clearly seen enough.
        if un >= HARD_SKIP_UNENGAGED_AFTER or en >= HARD_SKIP_ENGAGED_AFTER:
            continue
        features = compute_post_features(
            db, post, current_user_id,
            user_interest, affinity_cache, quality_cache, now,
            impression_cache=impression_cache,
        )
        score = compute_final_score(features)
        scored.append((post, score, features))
    
    # Sort by score descending. Tie-breaker uses a per-user-per-6-hour hash
    # so equal-score posts shuffle naturally across logins instead of
    # producing identical orderings for everyone.
    rot_bucket = f"{now.date()}:{now.hour // 6}:{current_user_id}"
    def _tiebreak(pid: str) -> str:
        return hashlib.md5(f"{rot_bucket}:{pid}".encode()).hexdigest()
    scored.sort(key=lambda x: (-x[1], _tiebreak(str(x[0].id))))
    
    # ── Step 4: Diversity Re-Ranking ──
    scored = apply_diversity_reranking(scored)
    
    # ── Step 5: Same-session dedup ──
    # Cross-session fatigue is already handled multiplicatively in scoring
    # (and via the hard-skip filter). Within a single session we hard-dedupe
    # so paginating downward never repeats a post.
    if session_id:
        try:
            session_seen = {
                str(r[0]) for r in db.query(FeedImpression.post_id)
                .filter(
                    FeedImpression.user_id == current_user_id,
                    FeedImpression.session_id == session_id,
                ).all()
            }
            if session_seen:
                scored = [t for t in scored if str(t[0].id) not in session_seen]
        except Exception:
            pass
    
    # ── Step 6: Paginate ──
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
    
    # ── Step 7: Log Impressions (best-effort) ──
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

    # Bust the per-user feed cache so the very next /posts/feed call
    # reflects this fresh signal instead of returning the stale 2-min
    # snapshot that made the feed feel "frozen" between sessions.
    try:
        from core.redis import invalidate_user_feed
        invalidate_user_feed(str(user_id))
    except Exception:
        pass

    return True


# ──────────────────────────────────────────────
# Quality Score Recomputation (Batch)
# ──────────────────────────────────────────────

def recompute_quality_scores(db: Session, max_posts: int = 1000):
    """
    Batch recompute quality scores for recent posts.
    FIX: Uses batch COUNT queries instead of N+1 per-post queries.
    """
    cutoff = datetime.utcnow() - timedelta(hours=168)  # 7 days

    posts = (
        db.query(UserFeed)
        .filter(UserFeed.is_active == True, UserFeed.created_at >= cutoff)
        .order_by(desc(UserFeed.created_at))
        .limit(max_posts)
        .all()
    )

    if not posts:
        return

    post_ids = [p.id for p in posts]
    author_ids = list({p.user_id for p in posts})

    # ── Batch load all counts ──
    # Image counts per post
    img_counts = {}
    for pid, cnt in db.query(UserFeedImage.feed_id, sa_func.count(UserFeedImage.id)).filter(
        UserFeedImage.feed_id.in_(post_ids)
    ).group_by(UserFeedImage.feed_id).all():
        img_counts[str(pid)] = cnt

    # Glow counts per post
    glow_counts = {}
    for pid, cnt in db.query(UserFeedGlow.feed_id, sa_func.count(UserFeedGlow.id)).filter(
        UserFeedGlow.feed_id.in_(post_ids)
    ).group_by(UserFeedGlow.feed_id).all():
        glow_counts[str(pid)] = cnt

    # Echo counts per post
    echo_counts = {}
    for pid, cnt in db.query(UserFeedEcho.feed_id, sa_func.count(UserFeedEcho.id)).filter(
        UserFeedEcho.feed_id.in_(post_ids)
    ).group_by(UserFeedEcho.feed_id).all():
        echo_counts[str(pid)] = cnt

    # Comment counts per post
    comment_counts = {}
    for pid, cnt in db.query(UserFeedComment.feed_id, sa_func.count(UserFeedComment.id)).filter(
        UserFeedComment.feed_id.in_(post_ids), UserFeedComment.is_active == True
    ).group_by(UserFeedComment.feed_id).all():
        comment_counts[str(pid)] = cnt

    # Author total glows (credibility) - batch per author
    author_glows = {}
    for uid, cnt in db.query(UserFeed.user_id, sa_func.count(UserFeedGlow.id)).join(
        UserFeedGlow, UserFeedGlow.feed_id == UserFeed.id
    ).filter(UserFeed.user_id.in_(author_ids)).group_by(UserFeed.user_id).all():
        author_glows[str(uid)] = cnt

    # Existing quality scores
    existing_scores = {}
    for q in db.query(PostQualityScore).filter(PostQualityScore.post_id.in_(post_ids)).all():
        existing_scores[str(q.post_id)] = q

    # ── Compute scores using batch data ──
    for post in posts:
        pid_str = str(post.id)
        quality = existing_scores.get(pid_str)

        if not quality:
            quality = PostQualityScore(post_id=post.id)
            db.add(quality)

        # Content richness
        richness = 0.3
        text_len = len(post.content or "")
        if text_len > 50: richness += 0.15
        if text_len > 200: richness += 0.1

        ic = img_counts.get(pid_str, 0)
        if ic > 0: richness += 0.2
        if ic > 1: richness += 0.1
        if post.video_url: richness += 0.15
        quality.content_richness = min(1.0, richness)

        # Engagement metrics
        gc = glow_counts.get(pid_str, 0)
        ec = echo_counts.get(pid_str, 0)
        cc = comment_counts.get(pid_str, 0)
        total = gc + ec * 2 + cc * 1.5
        quality.total_engagements = int(total)

        age_hours = max(0.1, (datetime.utcnow() - post.created_at).total_seconds() / 3600) if post.created_at else 1
        quality.engagement_velocity = total / age_hours

        # Author credibility
        ag = author_glows.get(str(post.user_id), 0)
        quality.author_credibility = min(1.0, 0.3 + ag * 0.01)

        quality.category = detect_category(post.content or "")

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
    session_id: Optional[str] = None,
) -> Tuple[List[UserFeed], Dict]:
    """
    Feed for new users with no interaction history.

    Strategy (improved):
      1. Pull a pool of recent public posts (3 days)
      2. Score using engagement velocity + recency (not raw counters)
      3. Cap event_share posts to ~30% so organic moments stay visible
      4. Per-user deterministic shuffle of equal-tier posts so no two users
         see the exact same chronological sequence on cold start
      5. Round-robin diversify by category for variety
    """
    import random as _random
    cutoff = datetime.utcnow() - timedelta(hours=72)

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
        .order_by(desc(UserFeed.created_at))
        .limit(300)
        .all()
    )

    if not posts:
        return [], {
            "page": page, "limit": limit,
            "total_items": 0, "total_pages": 1,
            "has_next": False, "has_previous": False,
        }

    # ── Pull recent impressions so cold-start rotates across logins ──
    # Same idea as the ranked path: posts the new user has already seen
    # 2+ times without engaging fall hard, otherwise everyone with the
    # same interests would see the identical sequence forever.
    impression_unengaged: Dict[str, int] = {}
    impression_engaged: Dict[str, int] = {}
    try:
        cs_cutoff = datetime.utcnow() - timedelta(hours=IMPRESSION_LOOKBACK_HOURS)
        post_ids = [p.id for p in posts]
        for pid, cnt in (
            db.query(FeedImpression.post_id, sa_func.count(FeedImpression.id))
            .filter(
                FeedImpression.user_id == current_user_id,
                FeedImpression.post_id.in_(post_ids),
                FeedImpression.created_at >= cs_cutoff,
            ).group_by(FeedImpression.post_id).all()
        ):
            impression_unengaged[str(pid)] = int(cnt)
        for pid, cnt in (
            db.query(FeedImpression.post_id, sa_func.count(FeedImpression.id))
            .filter(
                FeedImpression.user_id == current_user_id,
                FeedImpression.post_id.in_(post_ids),
                FeedImpression.created_at >= cs_cutoff,
                FeedImpression.was_engaged == True,
            ).group_by(FeedImpression.post_id).all()
        ):
            pid_s = str(pid)
            impression_engaged[pid_s] = int(cnt)
            impression_unengaged[pid_s] = max(0, impression_unengaged.get(pid_s, 0) - int(cnt))
    except Exception:
        pass

    # Pull onboarding interests so cold-start results lean toward the
    # categories the user said they care about. Falls back to pure
    # engagement+recency when no interests are set.
    interest_categories: set = set()
    try:
        from models.users import UserProfile
        up = db.query(UserProfile).filter(UserProfile.user_id == current_user_id).first()
        if up and isinstance(up.interests, list):
            for slug in up.interests:
                interest_categories.update(
                    ONBOARDING_TO_INTERNAL.get(str(slug).lower(), [])
                )
    except Exception:
        interest_categories = set()

    # ── Score each post: recency × engagement velocity ──
    now_utc = datetime.utcnow()

    def _score(p: UserFeed) -> float:
        age_h = max(0.5, (now_utc - p.created_at).total_seconds() / 3600.0) if p.created_at else 24.0
        eng = (p.glow_count or 0) + 2 * (p.echo_count or 0) + 1.5 * (p.spark_count or 0)
        # Recency-decayed engagement + freshness boost so brand-new posts surface
        base = (eng / (age_h ** 0.7)) + (5.0 / age_h)
        # Strong boost when the post matches one of the user's onboarding picks
        if interest_categories:
            cat = detect_category(p.content or "")
            if cat in interest_categories:
                base *= 2.2
        # Fade content the user has already been served
        pid_s = str(p.id)
        un = impression_unengaged.get(pid_s, 0)
        en = impression_engaged.get(pid_s, 0)
        base *= math.exp(-UNENGAGED_PENALTY_K * un - ENGAGED_DAMPENING * en)
        return base

    # Hard-skip saturated posts so they stop dominating cold-start logins
    scored = []
    for p in posts:
        pid_s = str(p.id)
        if impression_unengaged.get(pid_s, 0) >= HARD_SKIP_UNENGAGED_AFTER:
            continue
        if impression_engaged.get(pid_s, 0) >= HARD_SKIP_ENGAGED_AFTER:
            continue
        scored.append((p, _score(p)))

    # Per-user + 6-hour-bucket seed so the cold-start order rotates
    # across logins instead of being frozen forever.
    bucket = (datetime.utcnow().toordinal() * 4) + (datetime.utcnow().hour // 6)
    seed = (int(uuid.UUID(str(current_user_id)).int) ^ bucket) & 0xFFFFFFFF
    rng = _random.Random(seed)
    scored = [(p, s + rng.uniform(0, 0.25) * s) for (p, s) in scored]
    scored.sort(key=lambda t: -t[1])

    # Same-session dedup so paginating doesn't repeat
    if session_id:
        try:
            session_seen = {
                str(r[0]) for r in db.query(FeedImpression.post_id)
                .filter(
                    FeedImpression.user_id == current_user_id,
                    FeedImpression.session_id == session_id,
                ).all()
            }
            if session_seen:
                scored = [(p, s) for (p, s) in scored if str(p.id) not in session_seen]
        except Exception:
            pass

    # ── Cap event_share posts to 30% of the pool ──
    event_share_cap = max(2, int(len(scored) * 0.3))
    capped: List[UserFeed] = []
    es_count = 0
    overflow_event_shares: List[UserFeed] = []
    for p, _s in scored:
        if (p.post_type or 'post') == 'event_share':
            if es_count < event_share_cap:
                capped.append(p)
                es_count += 1
            else:
                overflow_event_shares.append(p)
        else:
            capped.append(p)
    # Append overflow at the tail so we never lose them entirely
    capped.extend(overflow_event_shares)

    # ── Round-robin by category for diversity ──
    categorized = defaultdict(list)
    for p in capped:
        cat = detect_category(p.content or "")
        categorized[cat].append(p)

    result: List[UserFeed] = []
    seen: set = set()
    while len(result) < len(capped):
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
