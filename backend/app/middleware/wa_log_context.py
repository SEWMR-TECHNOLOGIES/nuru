"""
WA log sender-attribution middleware
====================================
Decodes the request's auth token (Bearer header or ``session_id`` cookie)
and stashes the user id in a contextvar so every WhatsApp message sent
while handling that request is attributed to the user who triggered it
(``wa_message_logs.user_id``). Purely best-effort: any failure is
swallowed and the request proceeds unauthenticated for logging purposes.

Pure ASGI middleware (not BaseHTTPMiddleware) so the contextvar set here
propagates to the endpoint — including sync endpoints run in the
threadpool, which receive a copy of this context.
"""
from __future__ import annotations


class WaLogContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            try:
                headers = {k: v for k, v in (scope.get("headers") or [])}
                token = None
                auth = headers.get(b"authorization", b"").decode("latin-1")
                if auth.lower().startswith("bearer "):
                    token = auth[7:].strip()
                if not token:
                    cookie = headers.get(b"cookie", b"").decode("latin-1")
                    for part in cookie.split(";"):
                        k, _, v = part.strip().partition("=")
                        if k == "session_id" and v:
                            token = v
                            break
                if token:
                    import jwt
                    from core.config import ALGORITHM, SECRET_KEY
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    uid = payload.get("uid")
                    if uid:
                        from utils.wa_logging import set_wa_log_context
                        set_wa_log_context(user_id=str(uid))
            except Exception:  # noqa: BLE001
                pass
        await self.app(scope, receive, send)
