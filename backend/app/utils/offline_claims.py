"""Shared helpers for the offline-payment-claim flow.

Used by:
  * /user-contributors/.../self-contribute (contribution side)
  * /ticketing/.../offline-claim (ticket side)

Centralises:
  * Receipt image upload (image-only, ≤5 MB, ≥4 KB sanity floor) hitting the
    same UPLOAD_SERVICE_URL used everywhere else in the backend.
  * Notification recipient routing for contributors that opt-in to a
    secondary phone — returns the list of phones for SMS / WhatsApp / in-app
    based on the EventContributor.notify_target preference.

NOTE: secondary_phone is NEVER used to map a Nuru user account; it's purely
a comms address.
"""
from __future__ import annotations

import os
import uuid
from typing import List, Optional, Tuple

import httpx
from fastapi import UploadFile

from core.config import UPLOAD_SERVICE_URL


_ALLOWED_IMAGE_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
_MIN_BYTES = 4 * 1024            # reject empty / 1-byte uploads
_MAX_BYTES = 5 * 1024 * 1024     # 5 MB hard ceiling


async def upload_receipt_image(
    file: UploadFile,
    *,
    target_subdir: str = "payment-receipts",
) -> Tuple[bool, str, Optional[str]]:
    """Validate + upload a single receipt image.

    Returns (ok, message, url). If ok is False, url is None and message
    explains why so the caller can return a friendly standard_response.
    """
    if not file or not file.filename:
        return False, "No receipt file provided", None

    # MIME check first (cheaper than reading content)
    mime = (file.content_type or "").lower()
    if mime not in _ALLOWED_IMAGE_MIME:
        return False, "Only JPG, PNG or WebP images are allowed", None

    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in _ALLOWED_EXT:
        return False, "Unsupported file extension", None

    content = await file.read()
    size = len(content)
    if size < _MIN_BYTES:
        return False, "Receipt image is too small to be valid", None
    if size > _MAX_BYTES:
        return False, "Receipt image must be 5 MB or smaller", None

    unique_name = f"{uuid.uuid4().hex}{ext.lower()}"
    target_path = f"nuru/uploads/{target_subdir}/"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                UPLOAD_SERVICE_URL,
                data={"target_path": target_path},
                files={"file": (unique_name, content, mime)},
                timeout=20,
            )
        result = resp.json()
    except Exception as e:
        return False, f"Receipt upload failed: {e}", None

    if not result.get("success"):
        return False, result.get("message") or "Receipt upload failed", None

    return True, "ok", result["data"]["url"]


def contributor_notify_phones(ec) -> List[str]:
    """Return phone numbers to message for a given EventContributor row,
    honouring the notify_target preference. Falls back to whatever phone is
    populated when one side is missing. Always de-duplicated.
    """
    primary = (getattr(ec.contributor, "phone", None) or "").strip() if ec and ec.contributor else ""
    secondary = (getattr(ec, "secondary_phone", None) or "").strip()
    target = (getattr(ec, "notify_target", None) or "primary").lower()

    out: List[str] = []
    if target == "secondary":
        if secondary:
            out.append(secondary)
        elif primary:                       # graceful fallback
            out.append(primary)
    elif target == "both":
        if primary:
            out.append(primary)
        if secondary and secondary != primary:
            out.append(secondary)
    else:                                   # primary (default)
        if primary:
            out.append(primary)
        elif secondary:                     # graceful fallback
            out.append(secondary)
    return out


def contributor_notify_user_ids(ec) -> List[str]:
    """In-app recipients = the linked Nuru user only (if any).

    Secondary phone is never resolved to a user account by design, so in-app
    notifications only ever go to the linked primary user when notify_target
    is 'primary' or 'both'. When set to 'secondary', no in-app notification
    is created (the SMS/WA flow handles delivery).
    """
    target = (getattr(ec, "notify_target", None) or "primary").lower()
    if target == "secondary":
        return []
    user_id = getattr(ec.contributor, "contributor_user_id", None) if ec and ec.contributor else None
    return [str(user_id)] if user_id else []
