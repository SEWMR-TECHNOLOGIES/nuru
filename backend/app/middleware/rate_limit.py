"""
Redis-based Rate Limiting Middleware
====================================
Replaces the broken in-memory rate limiter (security.py RateLimitMiddleware)
that doesn't work across multiple Gunicorn workers.

Two middlewares:
  - RedisRateLimitMiddleware: general rate limit per IP
  - RedisAuthRateLimitMiddleware: tighter limit on auth endpoints only
"""

import re
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


def _get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For from NGINX."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def _cors_headers(request: Request) -> dict:
    """Build CORS headers matching main.py config so 429s aren't masked as CORS errors."""
    origin = request.headers.get("origin", "")
    allowed = {
        "https://app.nuru.tz", "https://www.nuru.tz", "https://nuru.tz",
        "https://workspace.nuru.tz", "http://app.nuru.tz",
        "http://localhost:8080", "http://127.0.0.1:8080", "http://192.168.100.7:8080",
    }
    headers = {"Retry-After": "60"}
    if origin in allowed:
        headers.update({
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        })
    return headers


def _rate_error(request: Request, message: str = "Too many requests. Please slow down.") -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"success": False, "message": message, "data": None},
        headers=_cors_headers(request),
    )


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """General per-IP rate limiter using Redis sliding window."""

    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60, exclude_paths: set = None):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.exclude_paths = exclude_paths or {"/health", "/docs", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        for prefix in self.exclude_paths:
            if path.startswith(prefix):
                return await call_next(request)

        ip = _get_client_ip(request)
        rate_key = f"rl:general:{ip}"

        from core.redis import rate_limit_check
        if not rate_limit_check(rate_key, self.max_requests, self.window_seconds):
            return _rate_error(request)

        return await call_next(request)


class RedisAuthRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Tighter rate limit on authentication endpoints only.
    Protects against brute-force login, OTP, and password reset attacks.
    """

    AUTH_PATTERN = re.compile(
        r'/api/v1/(auth/signin|auth/forgot-password|auth/forgot-password-phone|'
        r'auth/verify-reset-otp|users/signup|auth/reset-password|'
        r'users/verify-otp|users/request-otp)'
    )

    def __init__(self, app, max_requests: int = 10, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not self.AUTH_PATTERN.match(path):
            return await call_next(request)

        ip = _get_client_ip(request)
        rate_key = f"rl:auth:{ip}"

        from core.redis import rate_limit_check
        if not rate_limit_check(rate_key, self.max_requests, self.window_seconds):
            return _rate_error(request, "Too many authentication attempts. Please try again later.")

        return await call_next(request)