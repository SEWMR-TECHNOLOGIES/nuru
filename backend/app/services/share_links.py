"""Share-link helpers for guest contribution payments.

A "share link" is a URL the organiser can hand to a contributor who is NOT
a Nuru user — when opened it loads a public page where the contributor can
pay their pledge via the existing CheckoutModal flow.

We never store the plain token. Only its SHA-256 hash. The plain token is
returned exactly once on generation; the host can re-generate to invalidate.

Token shape: 32 url-safe base64 chars (~190 bits of entropy). Far more than
enough for one-pledge-scoped magic links.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models.contributions import EventContributor


SHARE_TOKEN_LIFETIME_DAYS = 90


def hash_token(token: str) -> str:
    """SHA-256 in lowercase hex — matches what we store in the DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    """32-char URL-safe random token."""
    # token_urlsafe(24) => 32 base64 chars
    return secrets.token_urlsafe(24)


def issue_share_token(db: Session, ec: EventContributor) -> str:
    """(Re)generate a share token for an event_contributor row.

    Returns the *plain* token — caller must hand it to the user once and
    never persist it. Persists only the hash + timestamps.
    """
    plain = generate_token()
    ec.share_token_hash = hash_token(plain)
    ec.share_token_created_at = datetime.utcnow()
    ec.share_token_expires_at = ec.share_token_created_at + timedelta(
        days=SHARE_TOKEN_LIFETIME_DAYS
    )
    ec.share_token_revoked_at = None
    db.flush()
    return plain


def find_by_token(db: Session, token: str) -> Optional[EventContributor]:
    """Look up the event_contributor by hashed token. Returns None if missing,
    expired or revoked."""
    if not token:
        return None
    h = hash_token(token.strip())
    ec = (
        db.query(EventContributor)
        .filter(EventContributor.share_token_hash == h)
        .first()
    )
    if not ec:
        return None
    if ec.share_token_revoked_at is not None:
        return None
    if ec.share_token_expires_at and ec.share_token_expires_at < datetime.utcnow():
        return None
    return ec


def host_for_currency(currency_code: Optional[str]) -> str:
    """Resolve the public host the SMS link should use.

    Driven by currency code (which is set per-event by the organiser):
      * TZS → nuru.tz
      * KES → nuru.ke
      * fallback → nuru.tz
    """
    code = (currency_code or "").upper()
    if code == "KES":
        return "nuru.ke"
    return "nuru.tz"


def build_share_url(currency_code: Optional[str], token: str) -> str:
    """Full https URL the contributor should open."""
    return f"https://{host_for_currency(currency_code)}/c/{token}"


def can_send_sms_for_currency(currency_code: Optional[str]) -> bool:
    """SMS dispatcher only handles TZ traffic for now (Sewmr is a TZ-only
    provider). KE will get SMS once the KE provider is wired in."""
    return (currency_code or "").upper() == "TZS"
