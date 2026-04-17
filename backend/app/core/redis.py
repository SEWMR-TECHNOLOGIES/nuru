"""
Redis Connection & Cache Utility Layer
=======================================
Provides:
  - A shared Redis connection pool
  - Generic get/set/delete with JSON serialization
  - Decorator-based caching for endpoint handlers
  - Key-pattern invalidation helpers
  - Graceful degradation: if Redis is down, requests hit the DB normally

Environment:
  REDIS_URL  – defaults to redis://localhost:6379/0
"""

import json
import os
import functools
import hashlib
from typing import Optional, Any, Callable
from datetime import timedelta

import redis

# ─────────────────────────────────────────────────────────
# Connection
# ─────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# Honor deployment mode: on Vercel (or wherever Redis isn't available) we
# completely skip the connection attempt so every cache call returns gracefully.
_DEPLOYMENT_MODE = os.getenv("DEPLOYMENT_MODE", "vps").lower().strip()
REDIS_ENABLED = _DEPLOYMENT_MODE != "vercel"

_pool: Optional[redis.ConnectionPool] = None


def _get_pool() -> Optional[redis.ConnectionPool]:
    global _pool
    if not REDIS_ENABLED:
        return None
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(
            REDIS_URL,
            max_connections=20,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
        )
    return _pool


def get_redis() -> Optional[redis.Redis]:
    """Return a Redis client from the shared pool, or None if disabled."""
    pool = _get_pool()
    if pool is None:
        return None
    return redis.Redis(connection_pool=pool)


def redis_available() -> bool:
    """Quick health check – True if Redis responds to PING."""
    if not REDIS_ENABLED:
        return False
    try:
        client = get_redis()
        return bool(client and client.ping())
    except Exception:
        return False


# ─────────────────────────────────────────────────────────
# Low-level helpers
# ─────────────────────────────────────────────────────────

def cache_get(key: str) -> Optional[Any]:
    """Get a cached value (returns deserialized Python object or None)."""
    try:
        raw = get_redis().get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> bool:
    """Set a cached value with TTL. Returns True on success."""
    try:
        get_redis().setex(key, ttl_seconds, json.dumps(value, default=str))
        return True
    except Exception:
        return False


def cache_delete(key: str) -> bool:
    """Delete a single key."""
    try:
        get_redis().delete(key)
        return True
    except Exception:
        return False


def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching a glob pattern (e.g. 'posts:user:*').
    Uses SCAN to avoid blocking."""
    try:
        r = get_redis()
        deleted = 0
        cursor = 0
        while True:
            cursor, keys = r.scan(cursor=cursor, match=pattern, count=200)
            if keys:
                deleted += r.delete(*keys)
            if cursor == 0:
                break
        return deleted
    except Exception:
        return 0


def cache_incr(key: str, amount: int = 1, ttl_seconds: int = 0) -> Optional[int]:
    """Atomic increment. Optionally sets TTL on first creation."""
    try:
        r = get_redis()
        val = r.incrby(key, amount)
        if ttl_seconds and val == amount:
            r.expire(key, ttl_seconds)
        return val
    except Exception:
        return None


# ─────────────────────────────────────────────────────────
# Key builders (centralized naming convention)
# ─────────────────────────────────────────────────────────

class CacheKeys:
    """Centralized cache key templates."""

    # Public / anonymous
    TRENDING_POSTS = "posts:trending:{limit}"                     # TTL 5 min
    PUBLIC_POST = "posts:public:{post_id}"                        # TTL 10 min

    # Per-user
    FEED = "feed:{user_id}:p{page}:l{limit}:m{mode}"             # TTL 2 min
    NOTIFICATIONS = "notif:{user_id}:p{page}:l{limit}"           # TTL 1 min
    UNREAD_COUNT = "notif:unread:{user_id}"                       # TTL 30 sec

    # Reference data (rarely changes)
    EVENT_TYPES = "ref:event_types"                               # TTL 30 min
    SERVICE_CATEGORIES = "ref:service_categories"                 # TTL 30 min

    # Invalidation patterns
    PAT_USER_FEED = "feed:{user_id}:*"
    PAT_USER_NOTIF = "notif:{user_id}:*"
    PAT_TRENDING = "posts:trending:*"
    PAT_ALL_FEEDS = "feed:*"

    @staticmethod
    def for_trending(limit: int) -> str:
        return CacheKeys.TRENDING_POSTS.format(limit=limit)

    @staticmethod
    def for_feed(user_id: str, page: int, limit: int, mode: str) -> str:
        return CacheKeys.FEED.format(user_id=user_id, page=page, limit=limit, mode=mode)

    @staticmethod
    def for_notifications(user_id: str, page: int, limit: int) -> str:
        return CacheKeys.NOTIFICATIONS.format(user_id=user_id, page=page, limit=limit)

    @staticmethod
    def for_unread(user_id: str) -> str:
        return CacheKeys.UNREAD_COUNT.format(user_id=user_id)


# ─────────────────────────────────────────────────────────
# Invalidation helpers (call on writes)
# ─────────────────────────────────────────────────────────

def invalidate_user_feed(user_id: str):
    """Bust all cached feed pages for a user."""
    cache_delete_pattern(CacheKeys.PAT_USER_FEED.format(user_id=user_id))


def invalidate_user_notifications(user_id: str):
    """Bust cached notification pages + unread count for a user."""
    cache_delete_pattern(CacheKeys.PAT_USER_NOTIF.format(user_id=user_id))
    cache_delete(CacheKeys.for_unread(user_id))


def invalidate_trending():
    """Bust all trending post caches."""
    cache_delete_pattern(CacheKeys.PAT_TRENDING)


def invalidate_all_feeds():
    """Nuclear option – bust every cached feed (use after quality score recompute)."""
    cache_delete_pattern(CacheKeys.PAT_ALL_FEEDS)


# ─────────────────────────────────────────────────────────
# Rate limiting via Redis
# ─────────────────────────────────────────────────────────

def rate_limit_check(key: str, max_requests: int, window_seconds: int) -> bool:
    """
    Sliding-window rate limiter.
    Returns True if request is ALLOWED, False if rate-limited.
    """
    try:
        r = get_redis()
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = pipe.execute()
        current = results[0]
        return current <= max_requests
    except Exception:
        return True  # Fail open if Redis is down
