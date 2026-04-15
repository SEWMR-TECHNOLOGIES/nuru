"""
Security middleware — hardened version.

Changes from original:
- REMOVED: in-memory RateLimitMiddleware (replaced by Redis-based middleware)
- KEPT: SecurityHeadersMiddleware, RequestValidationMiddleware
"""

import re
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def _error_response(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message, "data": None},
    )


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
            return _error_response(414, "Request URI too long")

        if self.BLOCKED_PATTERNS.search(url):
            return _error_response(400, "Invalid request")

        user_agent = request.headers.get("user-agent", "")
        if any(tool in user_agent.lower() for tool in ["sqlmap", "nikto", "dirbuster", "gobuster", "nuclei", "burpsuite"]):
            return _error_response(403, "Forbidden")

        return await call_next(request)
