"""
Security middleware for hardening the API against reconnaissance and attacks.
- Rate limiting per IP
- Security headers (anti-fingerprinting)
- Request validation
"""

import time
import re
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Shared CORS origins — keep in sync with main.py
ALLOWED_ORIGINS = [
    "https://app.nuru.tz",
    "https://www.nuru.tz",
    "https://nuru.tz",
    "https://workspace.nuru.tz",
    "https://nuru-blank-canvas.lovable.app",
    "https://id-preview--6627b5f8-6387-4257-935f-b76848f23ea5.lovable.app",
]

def _cors_headers(request: Request) -> dict[str, str]:
    """Build CORS headers based on the request origin."""
    origin = request.headers.get("origin", "")
    # Allow the origin if it matches our allowlist, otherwise don't set it
    if origin in ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Client-Id, X-Request-Time, X-Platform",
        }
    return {}


def _error_response(request: Request, status_code: int, message: str) -> JSONResponse:
    """Return a JSON error response with CORS headers attached."""
    headers = _cors_headers(request)
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message, "data": None},
        headers=headers,
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Token-bucket rate limiter per IP address.
    - General: 120 requests/minute
    - Auth endpoints: 10 requests/minute
    """

    def __init__(self, app, general_rpm: int = 120, auth_rpm: int = 10):
        super().__init__(app)
        self.general_rpm = general_rpm
        self.auth_rpm = auth_rpm
        self._buckets: dict[str, list] = defaultdict(list)
        self._auth_buckets: dict[str, list] = defaultdict(list)
        self._auth_patterns = re.compile(
            r'/api/v1/(auth/signin|auth/forgot-password|auth/forgot-password-phone|auth/verify-reset-otp|users/signup|auth/reset-password|users/verify-otp|users/request-otp)'
        )

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_rate_limited(self, bucket: list, limit: int) -> bool:
        now = time.time()
        bucket[:] = [t for t in bucket if now - t < 60]
        if len(bucket) >= limit:
            return True
        bucket.append(now)
        return False

    async def dispatch(self, request: Request, call_next):
        ip = self._get_client_ip(request)
        path = request.url.path

        if self._auth_patterns.match(path):
            if self._is_rate_limited(self._auth_buckets[ip], self.auth_rpm):
                resp = _error_response(request, 429, "Too many requests. Please try again later.")
                resp.headers["Retry-After"] = "60"
                return resp

        if self._is_rate_limited(self._buckets[ip], self.general_rpm):
            resp = _error_response(request, 429, "Too many requests. Please try again later.")
            resp.headers["Retry-After"] = "60"
            return resp

        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers.pop("server", None)
        response.headers.pop("x-powered-by", None)

        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Validates incoming requests for suspicious patterns."""

    MAX_URL_LENGTH = 2048
    BLOCKED_PATTERNS = re.compile(
        r'(\.\./|\.\.\\|;--|union\s+select|<script|javascript:|data:text/html)',
        re.IGNORECASE
    )

    async def dispatch(self, request: Request, call_next):
        url = str(request.url)

        if len(url) > self.MAX_URL_LENGTH:
            return _error_response(request, 414, "Request URI too long")

        if self.BLOCKED_PATTERNS.search(url):
            return _error_response(request, 400, "Invalid request")

        user_agent = request.headers.get("user-agent", "")
        if any(tool in user_agent.lower() for tool in ["sqlmap", "nikto", "dirbuster", "gobuster", "nuclei", "burpsuite"]):
            return _error_response(request, 403, "Forbidden")

        response = await call_next(request)
        return response
