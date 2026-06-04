"""Stable card URL service.

The single source of truth for "what is the public URL of <recipient>'s
<card_purpose> card for <event>/<related entity>?" Every card sender —
thank-you, invitation, RSVP, contribution receipt, vendor confirmation,
meeting invite, sendoff, wedding, future templates — must route through
:func:`generate_or_replace_card` so the recipient always sees the *same*
URL even when the card file is regenerated.

Design contract (see ``backend/app/docs/card_url_mappings.md``):

* Uniqueness key (``card_context_key``) = sha256 of
  ``recipient_type | recipient_id | card_purpose | event_id |
  related_entity_type | related_entity_id``.
  ``template_slug`` is intentionally NOT part of the key so design changes
  preserve the recipient-facing URL.
* Token is minted ONCE on first creation (``secrets.token_urlsafe(12)``)
  and never rotated.
* Storage path is deterministic per token, so re-uploads (Supabase Storage
  ``upsert: true``) replace the file in place — no orphaned objects.
* The public URL we hand to WhatsApp/SMS/email is the stable application
  URL (``https://{host}/card/{token}``) that resolves via the backend
  ``/api/v1/cards/public/by-token/{token}.{ext}`` route.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime
from typing import Any, Callable, Dict, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.card_url_mapping import CardUrlMapping


# ── Config ────────────────────────────────────────────────────────────


def _default_public_host() -> str:
    raw = (os.getenv("PUBLIC_APP_HOST") or os.getenv("API_BASE_URL") or "https://nuru.tz").strip()
    if "://" not in raw:
        raw = f"https://{raw}"
    return raw.rstrip("/")


# ── Key + token helpers ───────────────────────────────────────────────


def build_card_context_key(
    *,
    recipient_type: str,
    recipient_id: str,
    card_purpose: str,
    event_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
) -> str:
    """Deterministic SHA-256 of the recipient/purpose/context tuple.

    ``template_slug`` is deliberately excluded: switching the visual
    template for the same recipient + purpose + event must NOT change the
    public URL the recipient already received.
    """
    parts = [
        (recipient_type or "").strip().lower(),
        str(recipient_id or "").strip().lower(),
        (card_purpose or "").strip().lower(),
        str(event_id or "-").strip().lower(),
        (related_entity_type or "-").strip().lower(),
        str(related_entity_id or "-").strip().lower(),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _mint_token(db: Session) -> str:
    """Generate a URL-safe token that doesn't collide with an existing row."""
    for _ in range(8):
        candidate = secrets.token_urlsafe(12)  # ~16 chars
        existing = db.query(CardUrlMapping).filter(CardUrlMapping.token == candidate).first()
        if not existing:
            return candidate
    # Astronomically unlikely; fall back to a longer token.
    return secrets.token_urlsafe(24)


def _stable_storage_path(
    *,
    card_purpose: str,
    event_id: Optional[str],
    recipient_type: str,
    recipient_id: str,
    token: str,
    ext: str,
) -> str:
    """Deterministic object path so Supabase Storage ``upsert: true``
    silently replaces the previous render with no orphan files."""
    safe_ext = (ext or "png").lstrip(".").lower()
    return (
        f"cards/{card_purpose}/{event_id or 'global'}/"
        f"{recipient_type}/{recipient_id}/{token}.{safe_ext}"
    )


# ── Public API ────────────────────────────────────────────────────────


def get_existing_mapping(
    db: Session,
    *,
    recipient_type: str,
    recipient_id: str,
    card_purpose: str,
    event_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
) -> Optional[CardUrlMapping]:
    key = build_card_context_key(
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        card_purpose=card_purpose,
        event_id=event_id,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    return db.query(CardUrlMapping).filter(CardUrlMapping.card_context_key == key).first()


def generate_or_replace_card(
    db: Session,
    *,
    recipient_type: str,
    recipient_id: str,
    card_purpose: str,
    template_slug: Optional[str] = None,
    event_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    render_fn: Optional[Callable[[], Tuple[bytes, str, str]]] = None,
    uploader: Optional[Callable[[str, bytes, str], Optional[str]]] = None,
    pre_uploaded_url: Optional[str] = None,
    public_host: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Get-or-create the stable mapping, render/replace the file, return the
    stable public URL.

    Parameters
    ----------
    render_fn:
        ``() -> (bytes, mime, ext)`` — called only when we actually need a
        fresh render (i.e. not when ``pre_uploaded_url`` is supplied and the
        caller is happy to skip re-uploading to the stable path).
    uploader:
        ``(stable_path, bytes, mime) -> storage_url`` — must use upsert so
        the same path is overwritten. Required when ``render_fn`` is used.
    pre_uploaded_url:
        If the caller has already uploaded a render (e.g. frontend-rendered
        PNG), pass it here. We still record it on the mapping so the
        ``storage_url`` is current; the stable public URL still wins.
    """
    if not recipient_type or not recipient_id or not card_purpose:
        raise ValueError("recipient_type, recipient_id, card_purpose are required")

    host_base = (public_host or _default_public_host()).rstrip("/")
    key = build_card_context_key(
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        card_purpose=card_purpose,
        event_id=event_id,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )

    mapping = db.query(CardUrlMapping).filter(CardUrlMapping.card_context_key == key).first()
    created = False
    if not mapping:
        token = _mint_token(db)
        public_url = f"{host_base}/card/{token}"
        mapping = CardUrlMapping(
            card_context_key=key,
            token=token,
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            card_purpose=card_purpose,
            event_id=event_id,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            template_slug=template_slug,
            public_url=public_url,
            metadata_json=dict(extra_metadata or {}),
        )
        db.add(mapping)
        try:
            db.commit()
            db.refresh(mapping)
            created = True
        except IntegrityError:
            # Race: another worker minted the row first. Reload.
            db.rollback()
            mapping = db.query(CardUrlMapping).filter(CardUrlMapping.card_context_key == key).first()
            if not mapping:
                raise

    # Render + upload (only if we have something fresh to put behind the URL)
    replaced = False
    if render_fn is not None and uploader is not None:
        try:
            payload, mime, ext = render_fn()
        except Exception as exc:
            print(f"[card_url] render_fn failed token={mapping.token} err={exc!r}")
            payload = None  # type: ignore
            mime = None  # type: ignore
            ext = None  # type: ignore
        if payload:
            stable_path = _stable_storage_path(
                card_purpose=card_purpose,
                event_id=event_id,
                recipient_type=recipient_type,
                recipient_id=recipient_id,
                token=mapping.token,
                ext=ext or "png",
            )
            try:
                storage_url = uploader(stable_path, payload, mime or "application/octet-stream")
            except Exception as exc:
                print(f"[card_url] uploader failed path={stable_path} err={exc!r}")
                storage_url = None
            if storage_url:
                replaced = bool(mapping.storage_path)
                mapping.storage_path = stable_path
                mapping.storage_url = storage_url
                mapping.template_slug = template_slug or mapping.template_slug
                mapping.last_rendered_at = datetime.utcnow()
                db.commit()
                db.refresh(mapping)
    elif pre_uploaded_url:
        replaced = bool(mapping.storage_url) and mapping.storage_url != pre_uploaded_url
        mapping.storage_url = pre_uploaded_url
        mapping.template_slug = template_slug or mapping.template_slug
        mapping.last_rendered_at = datetime.utcnow()
        db.commit()
        db.refresh(mapping)

    action = "created" if created else ("replaced" if replaced else "reused")
    print(
        f"[card_url] {action} token={mapping.token} purpose={card_purpose} "
        f"recipient_type={recipient_type} recipient_id={recipient_id} "
        f"event_id={event_id} related={related_entity_type}:{related_entity_id} "
        f"path={mapping.storage_path} template={template_slug}"
    )

    return {
        "token": mapping.token,
        "public_url": mapping.public_url,
        "storage_url": mapping.storage_url,
        "storage_path": mapping.storage_path,
        "created": created,
        "replaced": replaced,
        "reused": (not created and not replaced),
    }
