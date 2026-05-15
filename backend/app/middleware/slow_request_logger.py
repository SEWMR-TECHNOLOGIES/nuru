"""
Slow Request Logging Middleware
================================
- Logs any HTTP request that takes longer than SLOW_REQUEST_THRESHOLD_MS.
- Adds an `X-Response-Time` header to every response.
- Records per-endpoint timing samples in Redis (sorted set) so the admin
  dashboard can display the slowest endpoints in the last hour.
- When Redis is unavailable (e.g. Vercel deployment) it falls back to an
  in-process ring buffer so the admin widget still works for that worker.
"""

import os
import time
import json
import logging
import threading
from collections import deque
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

log = logging.getLogger("nuru.perf")
if not log.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("[perf] %(message)s"))
    log.addHandler(h)
    log.setLevel(logging.INFO)

SLOW_THRESHOLD_MS = int(os.getenv("SLOW_REQUEST_THRESHOLD_MS", "800"))
# Default ON in production so the admin slow-endpoints dashboard has data.
_DEFAULT_LOG_SLOW = "true" if os.getenv("ENV", "development").lower() == "production" else "false"
LOG_SLOW_REQUESTS = os.getenv("LOG_SLOW_REQUESTS", _DEFAULT_LOG_SLOW).lower() == "true"
SAMPLE_RETENTION_SECONDS = 3600  # keep 1 hour of samples
REDIS_KEY = "perf:samples"  # sorted set: score = timestamp, member = json sample

# In-memory fallback (per-process)
_FALLBACK_LOCK = threading.Lock()
_FALLBACK: "deque[dict]" = deque(maxlen=5000)


def _record_sample(method: str, path: str, status: int, duration_ms: float):
    """Persist a timing sample for the admin slow-endpoints widget."""
    sample = {
        "ts": time.time(),
        "method": method,
        "path": path,
        "status": status,
        "ms": round(duration_ms, 1),
    }

    # Try Redis first
    try:
        from core.redis import get_redis, REDIS_ENABLED  # type: ignore
        if REDIS_ENABLED:
            r = get_redis()
            if r is not None:
                r.zadd(REDIS_KEY, {json.dumps(sample): sample["ts"]})
                # Trim anything older than retention window
                cutoff = sample["ts"] - SAMPLE_RETENTION_SECONDS
                r.zremrangebyscore(REDIS_KEY, "-inf", cutoff)
                # Hard cap at 10k entries so memory stays bounded under bursts
                r.zremrangebyrank(REDIS_KEY, 0, -10001)
                return
    except Exception:
        pass

    # Fallback to in-memory ring buffer
    with _FALLBACK_LOCK:
        _FALLBACK.append(sample)


def get_recent_samples(minutes: int = 60) -> list:
    """Return raw samples from the last `minutes`. Used by admin endpoint."""
    cutoff = time.time() - (minutes * 60)
    samples: list = []

    # Try Redis
    try:
        from core.redis import get_redis, REDIS_ENABLED  # type: ignore
        if REDIS_ENABLED:
            r = get_redis()
            if r is not None:
                raw = r.zrangebyscore(REDIS_KEY, cutoff, "+inf")
                for entry in raw or []:
                    try:
                        samples.append(json.loads(entry))
                    except Exception:
                        continue
                if samples:
                    return samples
    except Exception:
        pass

    # In-memory fallback
    with _FALLBACK_LOCK:
        samples = [s for s in _FALLBACK if s["ts"] >= cutoff]
    return samples


def _normalize_path(path: str) -> str:
    """Collapse UUIDs / numeric IDs in paths so /events/<uuid>/x groups together."""
    import re
    # UUID
    path = re.sub(
        r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        "/{id}",
        path,
        flags=re.IGNORECASE,
    )
    # Long numeric ids
    path = re.sub(r"/\d{3,}", "/{id}", path)
    return path


class SlowRequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0

        response.headers["X-Response-Time"] = f"{duration_ms:.0f}ms"

        path = _normalize_path(request.url.path)

        # Always record a sample so the admin widget reflects real traffic
        try:
            _record_sample(request.method, path, response.status_code, duration_ms)
        except Exception:
            pass

        if LOG_SLOW_REQUESTS and duration_ms >= SLOW_THRESHOLD_MS:
            try:
                log.warning(
                    "SLOW %s %s -> %d in %.0fms",
                    request.method,
                    path,
                    response.status_code,
                    duration_ms,
                )
            except Exception:
                pass
        return response
