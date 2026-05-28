"""Account-setup token helpers.

Used when one Nuru user registers another and we deliver a secure
one-time link (via WhatsApp Utility template) so the recipient sets
their own password on the web instead of receiving a temporary
password over WhatsApp (which Meta classifies as non-Utility).

Token discipline:
- Raw token is `secrets.token_urlsafe(32)` and is only returned at
  creation time so the caller can stitch it into the WhatsApp button
  URL. We never log or persist the raw token.
- Only the SHA-256 hash is stored.
- Tokens are single-use and expire after a configurable TTL (default
  24h to give the recipient time to open the link).
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models import AccountSetupToken, User


DEFAULT_TTL_MINUTES = 24 * 60  # 24 hours


def _hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_setup_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, _hash(raw)


@dataclass
class TokenLookup:
    user: Optional[User]
    state: str  # "valid" | "expired" | "used" | "invalid"
    token: Optional[AccountSetupToken] = None


def create_setup_token(
    db: Session,
    *,
    user_id,
    delivery_channel: str = "whatsapp",
    created_by=None,
    ttl_minutes: int = DEFAULT_TTL_MINUTES,
    purpose: str = "account_setup",
) -> str:
    """Persist a new setup token and return the raw token to deliver."""
    raw, token_hash = generate_setup_token()
    row = AccountSetupToken(
        user_id=user_id,
        token_hash=token_hash,
        purpose=purpose,
        delivery_channel=delivery_channel,
        created_by=created_by,
        expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
    )
    db.add(row)
    db.commit()
    return raw


def lookup_setup_token(db: Session, raw_token: str) -> TokenLookup:
    if not raw_token or len(raw_token) < 16:
        return TokenLookup(user=None, state="invalid")
    token = (
        db.query(AccountSetupToken)
        .filter(AccountSetupToken.token_hash == _hash(raw_token))
        .first()
    )
    if not token:
        return TokenLookup(user=None, state="invalid")
    if token.used_at is not None:
        return TokenLookup(user=None, state="used", token=token)
    if token.expires_at < datetime.utcnow():
        return TokenLookup(user=None, state="expired", token=token)
    user = db.query(User).filter(User.id == token.user_id).first()
    if not user or not user.is_active:
        return TokenLookup(user=None, state="invalid", token=token)
    return TokenLookup(user=user, state="valid", token=token)


def consume_setup_token(
    db: Session, raw_token: str, new_password_hash: str
) -> TokenLookup:
    """Atomically validate and consume the token, set the user's password
    hash, and clear must_change_password."""
    result = lookup_setup_token(db, raw_token)
    if result.state != "valid" or not result.user or not result.token:
        return result
    user = result.user
    user.password_hash = new_password_hash
    user.must_change_password = False
    user.temporary_password_expires_at = None
    user.account_setup_completed_at = datetime.utcnow()
    user.is_phone_verified = True  # accepting setup link via SMS/WA proves phone ownership
    result.token.used_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return result
