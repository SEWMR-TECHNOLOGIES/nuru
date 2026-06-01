"""
whatsapp_availability
=====================
Reusable helpers for checking + caching whether a phone number is
registered on WhatsApp.

Public API:
  - ensure_phone_status(db, raw_phone, country=None)
      → upserts a PhoneWhatsAppStatus row and returns it.
  - get_or_create_status(db, normalized_phone)
  - check_whatsapp_availability(phone, country=None)
      → high-level: normalize → cache lookup → provider check → upsert.
  - statuses_by_phones(db, phones, country=None)
      → bulk dict {normalized_phone: status_dict} for API serialization.

The actual provider call lives in `utils.whatsapp_check.check_whatsapp_number`
which calls the Supabase `whatsapp-send` edge function. We do **not** mark a
number as WhatsApp just because a Celery send succeeded — only when the
provider returns a definitive answer.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models.phone_whatsapp import PhoneWhatsAppStatus
from utils.phone_numbers import normalize_phone, phone_tail
from utils.whatsapp_check import check_whatsapp_number


# Freshness windows
FRESH_WHATSAPP_DAYS = 60          # confirmed yes — recheck after ~2 months
FRESH_NOT_WHATSAPP_DAYS = 45      # confirmed no — recheck after ~6 weeks
FRESH_UNKNOWN_HOURS = 6           # unknown — try again soon
FRESH_FAILED_HOURS = 12           # provider error — retry later


def _next_check_after(status: str) -> datetime:
    now = datetime.now(timezone.utc)
    if status == "whatsapp":
        return now + timedelta(days=FRESH_WHATSAPP_DAYS)
    if status == "not_whatsapp":
        return now + timedelta(days=FRESH_NOT_WHATSAPP_DAYS)
    if status == "failed":
        return now + timedelta(hours=FRESH_FAILED_HOURS)
    return now + timedelta(hours=FRESH_UNKNOWN_HOURS)


def _is_fresh(row: PhoneWhatsAppStatus) -> bool:
    if not row.last_checked_at:
        return False
    if row.status in ("unknown", "checking"):
        return False
    if not row.next_check_after:
        return False
    nca = row.next_check_after
    if nca.tzinfo is None:
        nca = nca.replace(tzinfo=timezone.utc)
    return nca > datetime.now(timezone.utc)


def ensure_phone_status(db: Session, raw_phone: str,
                        country: Optional[str] = None) -> Optional[PhoneWhatsAppStatus]:
    """Insert (or fetch) the cache row for a phone. Never calls the provider."""
    norm = normalize_phone(raw_phone, country=country)
    if not norm.get("ok") or not norm.get("normalized"):
        return None

    normalized = norm["normalized"]
    existing = (
        db.query(PhoneWhatsAppStatus)
        .filter(PhoneWhatsAppStatus.normalized_phone == normalized)
        .first()
    )
    if existing:
        return existing

    # Upsert to avoid races when two requests add the same number at once.
    stmt = pg_insert(PhoneWhatsAppStatus).values(
        raw_phone=norm.get("raw"),
        normalized_phone=normalized,
        country_code=norm.get("country_code") or None,
        national_number=norm.get("national_number") or None,
        normalization_status=norm.get("normalization_status") or "ok",
        normalization_error=norm.get("normalization_error"),
        status="unknown",
    ).on_conflict_do_nothing(index_elements=["normalized_phone"])
    db.execute(stmt)
    db.commit()
    return (
        db.query(PhoneWhatsAppStatus)
        .filter(PhoneWhatsAppStatus.normalized_phone == normalized)
        .first()
    )


def check_whatsapp_availability(db: Session, raw_phone: str,
                                country: Optional[str] = None,
                                force: bool = False) -> dict:
    """
    Normalize → look up cache → (maybe) hit provider → return status dict.

    Safe to call from request paths (will return cached value without
    blocking on the network). Background tasks pass `force=True` to refresh.
    """
    norm = normalize_phone(raw_phone, country=country)
    if not norm.get("ok"):
        return {
            "phone": raw_phone,
            "normalized_phone": None,
            "whatsapp_status": "invalid",
            "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }

    row = ensure_phone_status(db, raw_phone, country=country)
    if row is None:
        return {
            "phone": raw_phone,
            "normalized_phone": norm["normalized"],
            "whatsapp_status": "unknown",
            "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }

    if not force and _is_fresh(row):
        return _row_to_dict(row, raw_phone)

    # Hit the provider.
    row.status = "checking"
    row.check_attempts = (row.check_attempts or 0) + 1
    db.commit()

    result = check_whatsapp_number(row.normalized_phone)
    now = datetime.now(timezone.utc)
    if result is True:
        row.is_whatsapp = True
        row.status = "whatsapp"
        row.provider_error_code = None
        row.provider_error_message = None
    elif result is False:
        row.is_whatsapp = False
        row.status = "not_whatsapp"
        row.provider_error_code = None
        row.provider_error_message = None
    else:
        # Unknown / unreachable — keep prior is_whatsapp, mark failed for retry.
        row.status = "failed"
        row.provider_error_message = "provider returned unknown"

    row.last_checked_at = now
    row.next_check_after = _next_check_after(row.status)
    db.commit()
    print(f"[wa_availability] checked phone_tail={phone_tail(row.normalized_phone)} "
          f"status={row.status}")
    return _row_to_dict(row, raw_phone)


def _row_to_dict(row: PhoneWhatsAppStatus, raw_phone: Optional[str] = None) -> dict:
    return {
        "phone": raw_phone or row.raw_phone or row.normalized_phone,
        "normalized_phone": row.normalized_phone,
        "whatsapp_status": row.status or "unknown",
        "is_whatsapp": row.is_whatsapp,
        "whatsapp_last_checked_at": row.last_checked_at.isoformat()
            if row.last_checked_at else None,
    }


def statuses_by_phones(db: Session, phones: Iterable[Optional[str]],
                       country: Optional[str] = None) -> dict:
    """
    Bulk lookup helper for API serializers. Returns
        { normalized_phone: status_dict }
    for every input phone that normalises successfully. Never hits the
    provider — only reads the cache.
    """
    out: dict = {}
    keys = []
    raw_for_key = {}
    for raw in phones:
        if not raw:
            continue
        norm = normalize_phone(raw, country=country)
        if not norm.get("ok"):
            continue
        n = norm["normalized"]
        if n not in raw_for_key:
            raw_for_key[n] = raw
            keys.append(n)
    if not keys:
        return out
    rows = (
        db.query(PhoneWhatsAppStatus)
        .filter(PhoneWhatsAppStatus.normalized_phone.in_(keys))
        .all()
    )
    for r in rows:
        out[r.normalized_phone] = _row_to_dict(r, raw_for_key.get(r.normalized_phone))
    # For keys with no cached row yet, return an explicit "unknown" stub so
    # the frontend can show a neutral badge without an extra request.
    for n in keys:
        if n not in out:
            out[n] = {
                "phone": raw_for_key.get(n),
                "normalized_phone": n,
                "whatsapp_status": "unknown",
                "is_whatsapp": None,
                "whatsapp_last_checked_at": None,
            }
    return out


def status_for_phone(db: Session, raw_phone: Optional[str],
                     country: Optional[str] = None) -> dict:
    """Single-phone convenience wrapper around `statuses_by_phones`."""
    if not raw_phone:
        return {
            "phone": None, "normalized_phone": None,
            "whatsapp_status": "unknown", "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }
    bulk = statuses_by_phones(db, [raw_phone], country=country)
    if not bulk:
        return {
            "phone": raw_phone, "normalized_phone": None,
            "whatsapp_status": "unknown", "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }
    # single entry
    return next(iter(bulk.values()))
