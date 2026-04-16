"""
Slow Request Logging Middleware
================================
Logs any HTTP request that takes longer than SLOW_REQUEST_THRESHOLD_MS
to surface backend bottlenecks. Adds an `X-Response-Time` header to every
response so clients (and APM) can see real server-side timings.
"""

import os
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

log = logging.getLogger("nuru.perf")
if not log.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("[perf] %(message)s"))
    log.addHandler(h)
    log.setLevel(logging.INFO)

SLOW_THRESHOLD_MS = int(os.getenv("SLOW_REQUEST_THRESHOLD_MS", "500"))


class SlowRequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0

        response.headers["X-Response-Time"] = f"{duration_ms:.0f}ms"

        if duration_ms >= SLOW_THRESHOLD_MS:
            try:
                log.warning(
                    "SLOW %s %s -> %d in %.0fms",
                    request.method,
                    request.url.path,
                    response.status_code,
                    duration_ms,
                )
            except Exception:
                pass
        return response
