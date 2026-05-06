"""
SQL Query Logger & Slow Query Detection Middleware
====================================================
Logs all database queries with execution time.
Flags slow queries (>threshold) for performance debugging.

Enable via environment:
  QUERY_LOG_ENABLED=true
  QUERY_LOG_SLOW_THRESHOLD_MS=200   (default 200ms)
  QUERY_LOG_ALL=false                (log every query, not just slow ones)
"""

import os
import time
import logging
from sqlalchemy import event
from core.database import engine

logger = logging.getLogger("nuru.query")

ENABLED = os.getenv("QUERY_LOG_ENABLED", "false").lower() == "true"
SLOW_THRESHOLD_MS = int(os.getenv("QUERY_LOG_SLOW_THRESHOLD_MS", "1500"))
LOG_ALL = os.getenv("QUERY_LOG_ALL", "false").lower() == "true"


def _truncate(s: str, maxlen: int = 500) -> str:
    return s[:maxlen] + "..." if len(s) > maxlen else s


if ENABLED:
    @event.listens_for(engine, "before_cursor_execute")
    def _before_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info["query_start"] = time.perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def _after_execute(conn, cursor, statement, parameters, context, executemany):
        start = conn.info.pop("query_start", None)
        if start is None:
            return
        elapsed_ms = (time.perf_counter() - start) * 1000

        if elapsed_ms >= SLOW_THRESHOLD_MS:
            logger.warning(
                "SLOW QUERY (%.1fms): %s | params=%s",
                elapsed_ms,
                _truncate(statement),
                _truncate(str(parameters)),
            )
        elif LOG_ALL:
            logger.debug(
                "QUERY (%.1fms): %s",
                elapsed_ms,
                _truncate(statement, 200),
            )


# ─── Per-request query counter (optional middleware) ───

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import threading

_request_query_counts: dict[int, dict] = {}


def _get_request_stats() -> dict | None:
    return _request_query_counts.get(threading.get_ident())


class QueryCountMiddleware(BaseHTTPMiddleware):
    """
    Tracks per-request query count and total DB time.
    Adds X-DB-Query-Count and X-DB-Time-Ms headers to responses.
    Only active when QUERY_LOG_ENABLED=true.
    """

    async def dispatch(self, request: Request, call_next):
        if not ENABLED:
            return await call_next(request)

        tid = threading.get_ident()
        _request_query_counts[tid] = {"count": 0, "total_ms": 0.0}

        response = await call_next(request)

        stats = _request_query_counts.pop(tid, None)
        if stats:
            response.headers["X-DB-Query-Count"] = str(stats["count"])
            response.headers["X-DB-Time-Ms"] = f"{stats['total_ms']:.1f}"
            if stats["count"] > 20:
                logger.warning(
                    "HIGH QUERY COUNT: %s %s → %d queries (%.1fms DB time)",
                    request.method,
                    request.url.path,
                    stats["count"],
                    stats["total_ms"],
                )

        return response


if ENABLED:
    @event.listens_for(engine, "after_cursor_execute")
    def _count_query(conn, cursor, statement, parameters, context, executemany):
        stats = _get_request_stats()
        if stats is not None:
            stats["count"] += 1
            start = conn.info.get("query_start_count")
            if start:
                stats["total_ms"] += (time.perf_counter() - start) * 1000

    @event.listens_for(engine, "before_cursor_execute")
    def _count_before(conn, cursor, statement, parameters, context, executemany):
        conn.info["query_start_count"] = time.perf_counter()
