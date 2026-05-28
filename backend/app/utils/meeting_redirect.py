"""Meeting redirect-token helpers.

Used so the WhatsApp meeting-invitation Utility template can carry a
Meta-approved dynamic URL button (https://nuru.tz/m/{{1}}) without ever
embedding the raw meeting URL in the message body. The button hits the
public /m/{token} resolver which 302-redirects to the actual meeting
URL (a Nuru room today, possibly Zoom / Google Meet / Jitsi in future).

Token discipline:
- 24-byte url-safe random string (32 base64url chars). Unguessable but
  not a secret on its own; it appears in the WhatsApp button URL.
- Stored as plaintext in the dedicated table so we can resolve quickly;
  we don't hash it because the bearer = anyone with the URL by design.
- Expires after ``DEFAULT_TTL_HOURS`` (default 30 days, enough to cover
  long-running scheduled meetings). Each use bumps ``use_count`` and
  ``last_used_at`` so abuse is visible in admin.
- Bound to a meeting + the invited user where available so we can later
  enforce per-participant access if a meeting becomes private.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models import MeetingRedirectToken


DEFAULT_TTL_HOURS = 24 * 30  # 30 days


def _generate_token() -> str:
    return secrets.token_urlsafe(24)


def mint_meeting_redirect_token(
    db: Session,
    *,
    target_url: str,
    meeting_id=None,
    user_id=None,
    ttl_hours: int = DEFAULT_TTL_HOURS,
) -> str:
    """Persist a new redirect token and return the opaque public token.

    Best-effort: on any DB error (table missing in dev, etc.) the caller
    receives ``""`` so they can fall back to inline link delivery.
    """
    if not target_url:
        return ""
    try:
        token = _generate_token()
        row = MeetingRedirectToken(
            token=token,
            target_url=target_url,
            meeting_id=meeting_id,
            user_id=user_id,
            expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
        )
        db.add(row)
        db.commit()
        return token
    except Exception as e:  # pragma: no cover — defensive
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[MeetingRedirect] mint failed: {e}")
        return ""


def resolve_meeting_redirect_token(
    db: Session, token: str
) -> Optional[MeetingRedirectToken]:
    """Look up a token row. Returns None if missing / expired / revoked."""
    if not token:
        return None
    row = (
        db.query(MeetingRedirectToken)
        .filter(MeetingRedirectToken.token == token)
        .first()
    )
    if row is None:
        return None
    if row.revoked_at is not None:
        return None
    if row.expires_at and row.expires_at < datetime.utcnow():
        return None
    return row


def mark_used(db: Session, row: MeetingRedirectToken) -> None:
    try:
        row.last_used_at = datetime.utcnow()
        row.use_count = (row.use_count or 0) + 1
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
