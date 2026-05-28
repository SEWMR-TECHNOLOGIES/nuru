"""Public meeting redirect resolver.

Endpoints (all public, no auth — the bearer token IS the auth surrogate):

  GET /m/{token}              → 302 redirect to the real meeting URL
                                (or to a friendly HTML error page if the
                                token is missing / expired / revoked).
  GET /m/{token}/resolve      → JSON envelope returning the real URL so
                                SPA / mobile callers can route in-app
                                without a network hop through the web.

The /m/ prefix is the Meta-approved dynamic URL button base URL used by
the meeting-invitation WhatsApp templates (#7 / #8). See
``utils/meeting_redirect.py`` for token lifecycle and security notes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from core.database import get_db
from utils.helpers import standard_response
from utils.meeting_redirect import mark_used, resolve_meeting_redirect_token


router = APIRouter(prefix="/m", tags=["meeting-redirect"])


_ERROR_PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{title} | Nuru</title>
    <style>
      :root {{ color-scheme: light; }}
      body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, "Helvetica Neue", Arial, sans-serif;
        background: #f8f8fa; color: #0a1c40; margin: 0;
        min-height: 100vh; display: grid; place-items: center;
      }}
      .card {{
        max-width: 420px; padding: 40px 28px; text-align: center;
        background: #fff; border-radius: 24px;
        box-shadow: 0 18px 60px rgba(10, 28, 64, 0.08);
        border: 1px solid #e5e5ea;
      }}
      .badge {{
        width: 64px; height: 64px; border-radius: 20px;
        background: rgba(245, 180, 0, 0.12);
        color: #d49a00; margin: 0 auto 18px;
        display: grid; place-items: center; font-size: 28px;
      }}
      h1 {{ font-size: 20px; margin: 0 0 10px; font-weight: 800; }}
      p  {{ margin: 0; color: #5a6b85; line-height: 1.5; font-size: 14px; }}
      a.cta {{
        display: inline-block; margin-top: 22px; padding: 12px 22px;
        background: #f5b400; color: #fff; border-radius: 12px;
        text-decoration: none; font-weight: 700; font-size: 14px;
      }}
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">!</div>
      <h1>{title}</h1>
      <p>{message}</p>
      <a class="cta" href="https://nuru.tz">Open Nuru</a>
    </main>
  </body>
</html>"""


def _error_page(title: str, message: str, status: int = 410) -> HTMLResponse:
    return HTMLResponse(
        _ERROR_PAGE_TEMPLATE.format(title=title, message=message),
        status_code=status,
    )


@router.get("/{token}")
def resolve_and_redirect(token: str, db: Session = Depends(get_db)):
    """Tap-target for the WhatsApp meeting invitation button.

    Resolves the opaque token to a real meeting URL and 302-redirects.
    Returns a friendly HTML page when the link is no longer usable so
    the recipient sees branded copy instead of a raw JSON error.
    """
    row = resolve_meeting_redirect_token(db, token)
    if row is None:
        return _error_page(
            title="Meeting link expired",
            message=(
                "This meeting link is no longer active. Please ask the "
                "organiser to share a fresh invitation."
            ),
        )
    target = (row.target_url or "").strip()
    if not target:
        return _error_page(
            title="Meeting unavailable",
            message="We could not find the meeting for this link.",
            status=404,
        )
    mark_used(db, row)
    return RedirectResponse(url=target, status_code=302)


@router.get("/{token}/resolve")
def resolve_to_json(token: str, db: Session = Depends(get_db)):
    """JSON resolver used by the SPA / mobile deep-link handlers."""
    row = resolve_meeting_redirect_token(db, token)
    if row is None:
        return JSONResponse(
            status_code=410,
            content=standard_response(
                False,
                "This meeting link is no longer active.",
                errors=["EXPIRED_OR_INVALID"],
            ),
        )
    mark_used(db, row)
    # Best-effort enrichment so mobile clients can open MeetingRoomScreen
    # directly without a second round trip.
    meeting = getattr(row, "meeting", None)
    event_id = str(getattr(meeting, "event_id", "")) if meeting else None
    room_id = None
    try:
        # target_url is typically https://nuru.tz/meet/{room_id}
        from urllib.parse import urlparse
        path = urlparse(row.target_url or "").path or ""
        parts = [p for p in path.split("/") if p]
        if len(parts) >= 2 and parts[-2] in ("meet", "m"):
            room_id = parts[-1]
        elif parts:
            room_id = parts[-1]
    except Exception:
        room_id = None
    return standard_response(
        True,
        "Meeting link resolved.",
        data={
            "url": row.target_url,
            "target_url": row.target_url,
            "meeting_id": str(row.meeting_id) if row.meeting_id else None,
            "event_id": event_id or None,
            "room_id": room_id,
        },
    )

