"""
Admin Monitoring Endpoints — Redis, Celery & DB observability.
Mounted at /admin/monitoring/...

Includes alerting thresholds:
- Redis cache hit rate < 80% → warning
- Celery queue depth > 100 → warning
- DB query count per request > 50 → warning (via middleware headers)
- Slow queries with mean > 500ms → critical
- Pool exhaustion (overflow > pool_size) → warning
"""

from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db

router = APIRouter(prefix="/admin/monitoring", tags=["Admin Monitoring"])


# ─── Auth gate (reuse admin token check) ───

def _require_admin(request: Request, db: Session = Depends(get_db)):
    from api.routes.admin import require_admin
    return require_admin(request, db)


def _make_alerts(checks: list[tuple[bool, str, str]]) -> list[dict]:
    """checks = [(condition_is_bad, level, message), ...]"""
    return [{"level": lvl, "message": msg} for cond, lvl, msg in checks if cond]


# ══════════════════════════════════════════════
# 1. Redis Health & Stats
# ══════════════════════════════════════════════

@router.get("/redis")
def redis_stats(_admin=Depends(_require_admin)):
    """Cache hit rates, memory, connected clients, key counts."""
    from core.redis import get_redis, redis_available

    if not redis_available():
        return {"success": True, "data": {"status": "unavailable", "alerts": [{"level": "critical", "message": "Redis is DOWN — caching and rate limiting disabled"}]}}

    r = get_redis()
    info = r.info()

    total_keys = sum(
        v.get("keys", 0) for k, v in info.items()
        if k.startswith("db") and isinstance(v, dict)
    )

    keyspace_hits = info.get("keyspace_hits", 0)
    keyspace_misses = info.get("keyspace_misses", 0)
    total_lookups = keyspace_hits + keyspace_misses
    hit_rate = round(keyspace_hits / total_lookups * 100, 2) if total_lookups > 0 else 0.0

    used_memory_mb = round(info.get("used_memory", 0) / 1024 / 1024, 2)
    peak_memory_mb = round(info.get("used_memory_peak", 0) / 1024 / 1024, 2)

    # Key breakdown by prefix
    prefix_counts: dict[str, int] = {}
    cursor = 0
    scanned = 0
    while scanned < 5000:
        cursor, keys = r.scan(cursor=cursor, count=500)
        for k in keys:
            prefix = k.split(":")[0] if ":" in k else k
            prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1
        scanned += len(keys)
        if cursor == 0:
            break

    # Alerting thresholds
    alerts = _make_alerts([
        (total_lookups > 100 and hit_rate < 80, "warning", f"Cache hit rate is {hit_rate}% (threshold: 80%)"),
        (total_lookups > 100 and hit_rate < 50, "critical", f"Cache hit rate critically low at {hit_rate}%"),
        (used_memory_mb > 400, "warning", f"Redis memory usage high: {used_memory_mb}MB"),
        (info.get("connected_clients", 0) > 100, "warning", f"High client count: {info.get('connected_clients')} connected"),
    ])

    return {
        "success": True,
        "data": {
            "status": "connected",
            "uptime_seconds": info.get("uptime_in_seconds"),
            "connected_clients": info.get("connected_clients"),
            "used_memory_mb": used_memory_mb,
            "peak_memory_mb": peak_memory_mb,
            "total_keys": total_keys,
            "cache_hit_rate_pct": hit_rate,
            "keyspace_hits": keyspace_hits,
            "keyspace_misses": keyspace_misses,
            "ops_per_second": info.get("instantaneous_ops_per_sec"),
            "key_prefixes": dict(sorted(prefix_counts.items(), key=lambda x: -x[1])[:20]),
            "alerts": alerts,
        },
    }


# ══════════════════════════════════════════════
# 2. Celery Queue Depths & Workers
# ══════════════════════════════════════════════

@router.get("/celery")
def celery_stats(_admin=Depends(_require_admin)):
    """Active workers, queue depths, recent task results."""
    from core.redis import get_redis, redis_available
    from core.celery_app import celery_app

    data: dict = {"workers": {}, "queues": {}, "scheduled_tasks": [], "alerts": []}
    alerts_raw: list[tuple[bool, str, str]] = []

    # Worker inspection
    try:
        inspector = celery_app.control.inspect(timeout=2.0)
        active = inspector.active() or {}
        stats = inspector.stats() or {}
        if not stats:
            alerts_raw.append((True, "critical", "No Celery workers are running"))
        for worker_name, worker_stats in stats.items():
            data["workers"][worker_name] = {
                "status": "online",
                "active_tasks": len(active.get(worker_name, [])),
                "pool_size": worker_stats.get("pool", {}).get("max-concurrency", "?"),
                "uptime": worker_stats.get("uptime", 0),
            }
    except Exception:
        data["workers"] = {"error": "Could not reach workers (timeout or offline)"}
        alerts_raw.append((True, "critical", "Cannot connect to Celery workers"))

    # Queue depths from Redis
    if redis_available():
        r = get_redis()
        for queue_name in ["celery", "default"]:
            try:
                depth = r.llen(queue_name)
                data["queues"][queue_name] = depth
                alerts_raw.append((depth > 100, "warning", f"Queue '{queue_name}' has {depth} pending tasks (threshold: 100)"))
                alerts_raw.append((depth > 500, "critical", f"Queue '{queue_name}' critically backed up with {depth} tasks"))
            except Exception:
                data["queues"][queue_name] = "error"

    # Beat schedule
    try:
        beat_schedule = celery_app.conf.beat_schedule or {}
        data["scheduled_tasks"] = [
            {"name": name, "task": cfg.get("task"), "schedule": str(cfg.get("schedule"))}
            for name, cfg in beat_schedule.items()
        ]
    except Exception:
        pass

    data["alerts"] = _make_alerts(alerts_raw)
    return {"success": True, "data": data}


# ══════════════════════════════════════════════
# 3. Database Performance Stats
# ══════════════════════════════════════════════

@router.get("/database")
def database_stats(db: Session = Depends(get_db), _admin=Depends(_require_admin)):
    """Connection pool, table sizes, and slow query log from pg_stat_statements."""
    from core.database import engine

    pool = engine.pool
    pool_size = pool.size() if hasattr(pool, 'size') else 0
    overflow = pool.overflow() if hasattr(pool, 'overflow') else 0
    checked_out = pool.checkedout() if hasattr(pool, 'checkedout') else 0

    pool_info = {
        "pool_size": pool_size,
        "checked_in": pool.checkedin() if hasattr(pool, 'checkedin') else None,
        "checked_out": checked_out,
        "overflow": overflow,
    }

    alerts_raw: list[tuple[bool, str, str]] = [
        (overflow > pool_size and pool_size > 0, "warning", f"Connection pool overflow ({overflow}) exceeds pool size ({pool_size})"),
        (checked_out > pool_size * 0.9 and pool_size > 0, "warning", f"Connection pool near exhaustion: {checked_out}/{pool_size} checked out"),
    ]

    # Table sizes
    table_sizes = []
    try:
        rows = db.execute(text("""
            SELECT relname AS table_name,
                   pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
                   pg_total_relation_size(c.oid) AS size_bytes,
                   n_live_tup AS row_estimate
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY pg_total_relation_size(c.oid) DESC
            LIMIT 20
        """)).fetchall()
        table_sizes = [
            {"table": r[0], "size": r[1], "size_bytes": r[2], "rows": r[3]}
            for r in rows
        ]
    except Exception as e:
        table_sizes = [{"error": str(e)}]

    # Slow queries from pg_stat_statements
    slow_queries = []
    try:
        rows = db.execute(text("""
            SELECT query, calls, mean_exec_time, total_exec_time,
                   rows, shared_blks_hit, shared_blks_read
            FROM pg_stat_statements
            WHERE mean_exec_time > 100
            ORDER BY mean_exec_time DESC
            LIMIT 15
        """)).fetchall()
        for r in rows:
            mean_ms = round(r[2], 1)
            slow_queries.append({
                "query": r[0][:300],
                "calls": r[1],
                "mean_ms": mean_ms,
                "total_ms": round(r[3], 1),
                "rows": r[4],
                "cache_hit_ratio": round(r[5] / max(r[5] + r[6], 1) * 100, 1),
            })
            if mean_ms > 500:
                alerts_raw.append((True, "critical", f"Query averaging {mean_ms}ms: {r[0][:80]}..."))
            elif mean_ms > 200:
                alerts_raw.append((True, "warning", f"Slow query averaging {mean_ms}ms: {r[0][:80]}..."))
    except Exception:
        slow_queries = [{"note": "pg_stat_statements extension not installed"}]

    # Active connections
    active_conns = 0
    try:
        row = db.execute(text("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")).scalar()
        active_conns = row
    except Exception:
        pass

    alerts_raw.append((active_conns > 50, "warning", f"High active DB connections: {active_conns}"))

    return {
        "success": True,
        "data": {
            "pool": pool_info,
            "active_connections": active_conns,
            "table_sizes": table_sizes,
            "slow_queries": slow_queries,
            "alerts": _make_alerts(alerts_raw),
        },
    }


# ══════════════════════════════════════════════
# 4. Slow Endpoints (last hour) — sourced from SlowRequestLoggerMiddleware
# ══════════════════════════════════════════════

@router.get("/slow-endpoints")
def slow_endpoints(minutes: int = 60, limit: int = 25, _admin=Depends(_require_admin)):
    """
    Aggregate per-endpoint timing samples captured by SlowRequestLoggerMiddleware.
    Returns the slowest endpoints in the last `minutes` window (default 60).
    """
    from middleware.slow_request_logger import get_recent_samples, SLOW_THRESHOLD_MS

    minutes = max(1, min(minutes, 1440))  # clamp 1 min .. 24 h
    limit = max(1, min(limit, 200))

    samples = get_recent_samples(minutes=minutes)

    # Aggregate per (method, path)
    grouped: dict = {}
    for s in samples:
        key = f"{s['method']} {s['path']}"
        g = grouped.setdefault(key, {
            "method": s["method"],
            "path": s["path"],
            "count": 0,
            "total_ms": 0.0,
            "max_ms": 0.0,
            "slow_count": 0,
            "errors": 0,
            "samples_ms": [],
        })
        g["count"] += 1
        g["total_ms"] += s["ms"]
        if s["ms"] > g["max_ms"]:
            g["max_ms"] = s["ms"]
        if s["ms"] >= SLOW_THRESHOLD_MS:
            g["slow_count"] += 1
        if s.get("status", 200) >= 500:
            g["errors"] += 1
        g["samples_ms"].append(s["ms"])

    rows = []
    for g in grouped.values():
        n = max(1, g["count"])
        sorted_ms = sorted(g["samples_ms"])
        p95_idx = max(0, int(len(sorted_ms) * 0.95) - 1)
        rows.append({
            "method": g["method"],
            "path": g["path"],
            "count": g["count"],
            "avg_ms": round(g["total_ms"] / n, 1),
            "p95_ms": round(sorted_ms[p95_idx], 1),
            "max_ms": round(g["max_ms"], 1),
            "slow_count": g["slow_count"],
            "error_count": g["errors"],
        })

    rows.sort(key=lambda r: r["avg_ms"], reverse=True)
    rows = rows[:limit]

    return {
        "success": True,
        "data": {
            "window_minutes": minutes,
            "threshold_ms": SLOW_THRESHOLD_MS,
            "total_samples": len(samples),
            "endpoints": rows,
        },
    }


# ══════════════════════════════════════════════
# 5. Combined Health Overview
# ══════════════════════════════════════════════

@router.get("/health")
def monitoring_health(_admin=Depends(_require_admin)):
    """Quick combined health check for all subsystems."""
    from core.redis import redis_available
    import os

    deployment_mode = os.getenv("DEPLOYMENT_MODE", "vps").lower().strip()
    redis_ok = redis_available()

    celery_ok = False
    if deployment_mode != "vercel":
        try:
            from core.celery_app import celery_app
            inspector = celery_app.control.inspect(timeout=1.0)
            ping = inspector.ping()
            celery_ok = bool(ping)
        except Exception:
            pass

    return {
        "success": True,
        "data": {
            "deployment_mode": deployment_mode,
            "redis": "ok" if redis_ok else ("disabled" if deployment_mode == "vercel" else "down"),
            "celery": "ok" if celery_ok else ("disabled" if deployment_mode == "vercel" else "down"),
            "api": "ok",
        },
    }
