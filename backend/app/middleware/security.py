"""
Security middleware — hardened version.

- Uses proper header handling (no .pop() on MutableHeaders)
- Avoids duplication of headers
- Keeps validation logic separate and clean
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


# ------------------------------------------------------------------
# Security Headers Middleware (ONLY place headers are set)
# ------------------------------------------------------------------
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

        # Correct way to remove headers
        if "server" in response.headers:
            del response.headers["server"]

        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response


# ------------------------------------------------------------------
# Request Validation Middleware (NO header duplication)
# ------------------------------------------------------------------
class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Validates incoming requests for suspicious patterns."""

    MAX_URL_LENGTH = 2048
    BLOCKED_PATTERNS = re.compile(
        r'(\.\./|\.\.\\|;--|union\s+select|<script|javascript:|data:text/html)',
        re.IGNORECASE
    )

    async def dispatch(self, request: Request, call_next):
        url = str(request.url)

        # URL length check
        if len(url) > self.MAX_URL_LENGTH:
            return _error_response(414, "Request URI too long")

        # Basic attack pattern detection
        if self.BLOCKED_PATTERNS.search(url):
            return _error_response(400, "Invalid request")

        # Block known scanning tools
        user_agent = request.headers.get("user-agent", "")
        if any(tool in user_agent.lower() for tool in [
            "sqlmap", "nikto", "dirbuster", "gobuster", "nuclei", "burpsuite"
        ]):
            return _error_response(403, "Forbidden")

        return await call_next(request)