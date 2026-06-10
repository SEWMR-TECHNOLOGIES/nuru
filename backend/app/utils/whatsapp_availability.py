"""
whatsapp_availability
=====================
WhatsApp availability cache. Policy:

* We DO NOT actively probe Meta to check if a number is on WhatsApp.
  Meta has no silent lookup — every probe is a real message. We will not
  spam users with `hello_world` or any other template purely to learn
  their status.

* Availability is learned opportunistically from REAL Nuru sends:
  invitation, OTP, contribution receipt, pledge reminder, thank-you card,
  meeting invite, vendor / booking notification, etc.

  * Provider returned a real message id (preferably ``wamid.*``)
        → status="available", is_whatsapp=True
  * Provider returned 131026 / 131047 / explicit "not on WhatsApp"
        → status="unavailable", is_whatsapp=False
  * Anything else (config error, template issue, auth, media fetch,
    provider outage) → status="error" / "unknown" with provider error
    captured but is_whatsapp left as-is. Phone is NEVER punished for
    our system problems.

Public API:
  - ensure_phone_status(db, raw_phone, country=None)
        upsert an "unknown" row. Does NOT call the provider.
  - record_send_outcome(db, raw_phone, *, message_id=None,
                        not_on_whatsapp=False, error_code=None,
                        error_message=None, action=None)
        called from the WhatsApp dispatch task after every real send.
  - statuses_by_phones(db, phones, country=None)
        bulk cache lookup for API serializers.
  - status_for_phone(db, raw_phone, country=None)
        single-phone convenience wrapper.

Legacy names kept as no-ops / cache reads so existing imports don't break:
  - check_whatsapp_availability(...)  → cache-only lookup
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models.phone_whatsapp import PhoneWhatsAppStatus
from utils.phone_numbers import normalize_phone, phone_tail


# Freshness windows
FRESH_AVAILABLE_DAYS = 60        # confirmed on WhatsApp — trust for ~2 months
FRESH_UNAVAILABLE_DAYS = 30      # confirmed not on WhatsApp — re-evaluate after ~1 month
FRESH_ERROR_DAYS = 3             # provider/system error — wait, don't penalise phone
FRESH_PENDING_DAYS = 1           # API accepted message — waiting for delivery webhook
FRESH_UNKNOWN_DAYS = 7           # untouched cache row — long backoff, no probing

# Status vocabulary written to the DB
ST_AVAILABLE = "available"
ST_UNAVAILABLE = "unavailable"
ST_UNKNOWN = "unknown"
ST_ERROR = "error"
# API accepted the message (got wamid) but Meta has NOT yet confirmed
# delivery via webhook. Meta returns a wamid for almost any well-formed
# number; presence of wamid alone does NOT prove WhatsApp availability.
ST_PENDING = "pending"

# Meta error codes that DEFINITIVELY mean "recipient is not on WhatsApp"
NOT_ON_WHATSAPP_CODES = {"131026", "131047"}


def _next_check_after(status: str) -> datetime:
    now = datetime.now(timezone.utc)
    if status == ST_AVAILABLE:
        return now + timedelta(days=FRESH_AVAILABLE_DAYS)
    if status == ST_UNAVAILABLE:
        return now + timedelta(days=FRESH_UNAVAILABLE_DAYS)
    if status == ST_ERROR:
        return now + timedelta(days=FRESH_ERROR_DAYS)
    if status == ST_PENDING:
        return now + timedelta(days=FRESH_PENDING_DAYS)
    return now + timedelta(days=FRESH_UNKNOWN_DAYS)



# ──────────────────────────────────────────────
# Upsert helpers
# ──────────────────────────────────────────────
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

    stmt = pg_insert(PhoneWhatsAppStatus).values(
        raw_phone=norm.get("raw"),
        normalized_phone=normalized,
        country_code=norm.get("country_code") or None,
        national_number=norm.get("national_number") or None,
        normalization_status=norm.get("normalization_status") or "ok",
        normalization_error=norm.get("normalization_error"),
        status=ST_UNKNOWN,
    ).on_conflict_do_nothing(index_elements=["normalized_phone"])
    db.execute(stmt)
    db.commit()
    return (
        db.query(PhoneWhatsAppStatus)
        .filter(PhoneWhatsAppStatus.normalized_phone == normalized)
        .first()
    )


# ──────────────────────────────────────────────
# Cache reads (used by APIs)
# ──────────────────────────────────────────────
def _row_to_dict(row: PhoneWhatsAppStatus, raw_phone: Optional[str] = None) -> dict:
    return {
        "phone": raw_phone or row.raw_phone or row.normalized_phone,
        "normalized_phone": row.normalized_phone,
        "whatsapp_status": row.status or ST_UNKNOWN,
        "is_whatsapp": row.is_whatsapp,
        "whatsapp_last_checked_at": row.last_checked_at.isoformat()
            if row.last_checked_at else None,
    }


def check_whatsapp_availability(db: Session, raw_phone: str,
                                country: Optional[str] = None,
                                force: bool = False) -> dict:  # noqa: ARG001
    """
    Cache-only lookup. Kept for backwards-compatibility with old callers —
    `force` is ignored because active probing is disabled by policy.
    Always returns whatever the cache has (or seeds an "unknown" row).
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
            "whatsapp_status": ST_UNKNOWN,
            "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }
    return _row_to_dict(row, raw_phone)


def statuses_by_phones(db: Session, phones: Iterable[Optional[str]],
                       country: Optional[str] = None) -> dict:
    """
    Bulk cache lookup. Never hits the provider.
    Returns { normalized_phone: status_dict }.
    """
    out: dict = {}
    keys = []
    raw_for_key: dict = {}
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
    for n in keys:
        if n not in out:
            out[n] = {
                "phone": raw_for_key.get(n),
                "normalized_phone": n,
                "whatsapp_status": ST_UNKNOWN,
                "is_whatsapp": None,
                "whatsapp_last_checked_at": None,
            }
    return out


def status_for_phone(db: Session, raw_phone: Optional[str],
                     country: Optional[str] = None) -> dict:
    if not raw_phone:
        return {
            "phone": None, "normalized_phone": None,
            "whatsapp_status": ST_UNKNOWN, "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }
    bulk = statuses_by_phones(db, [raw_phone], country=country)
    if not bulk:
        return {
            "phone": raw_phone, "normalized_phone": None,
            "whatsapp_status": ST_UNKNOWN, "is_whatsapp": None,
            "whatsapp_last_checked_at": None,
        }
    return next(iter(bulk.values()))


# ──────────────────────────────────────────────
# Opportunistic learner — call after every real Nuru WhatsApp send
# ──────────────────────────────────────────────
def record_send_outcome(
    db: Session,
    raw_phone: str,
    *,
    message_id: Optional[str] = None,
    not_on_whatsapp: bool = False,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    action: Optional[str] = None,
    country: Optional[str] = None,
) -> None:
    """
    Update phone_whatsapp_statuses based on the outcome of a REAL Nuru send.

    * message_id present (preferably ``wamid.*``)
          → status="available", is_whatsapp=True
    * not_on_whatsapp=True OR error_code ∈ {131026, 131047}
          → status="unavailable", is_whatsapp=False
    * any other error
          → status="error", is_whatsapp unchanged, error stored.
          We do NOT mark the phone as unavailable for a system / config /
          template / auth / media / outage issue.
    """
    try:
        row = ensure_phone_status(db, raw_phone, country=country)
        if row is None:
            return

        now = datetime.now(timezone.utc)
        tail = phone_tail(row.normalized_phone)
        ec = str(error_code) if error_code is not None else None
        updated = False

        if message_id:
            # IMPORTANT: presence of wamid only means Meta accepted the API
            # call. Meta returns a wamid for almost any well-formed phone;
            # it does NOT confirm the recipient is on WhatsApp. We mark
            # the row as PENDING and wait for the delivery webhook
            # (see record_delivery_outcome). Never overwrite a previously
            # confirmed availability/unavailability with a weaker signal.
            if row.is_whatsapp is None:
                row.status = ST_PENDING
                row.provider_response_code = "200"
                row.provider_error_code = None
                row.provider_error_message = None
                updated = True
        elif not_on_whatsapp or (ec in NOT_ON_WHATSAPP_CODES):
            row.is_whatsapp = False
            row.status = ST_UNAVAILABLE
            row.provider_error_code = ec
            row.provider_error_message = error_message
            updated = True
        elif ec or error_message:
            # System / config / template / auth / media / outage — do not
            # punish the phone, but remember the error and back off.
            row.status = ST_ERROR
            row.provider_error_code = ec
            row.provider_error_message = error_message
            updated = True
        else:
            # No signal at all — leave row untouched.
            return

        row.last_checked_at = now
        row.next_check_after = _next_check_after(row.status)
        db.commit()
        print(
            f"[wa_availability] learned phone_tail={tail} status={row.status} "
            f"is_whatsapp={row.is_whatsapp} source=real_send action={action or '-'} "
            f"message_id={message_id or '-'} error_code={ec or '-'} updated={updated}"
        )
    except Exception as e:  # noqa: BLE001
        print(f"[wa_availability] record_send_outcome failed: {e}")


def record_delivery_outcome(
    db: Session,
    raw_phone: str,
    *,
    delivery_status: str,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    country: Optional[str] = None,
) -> None:
    """
    Update phone_whatsapp_statuses from a REAL Meta delivery webhook callback.

    Meta's webhook is the ONLY authoritative signal for whether the recipient
    is actually on WhatsApp:

    * delivery_status in {"sent", "delivered", "read"}  → on WhatsApp
    * delivery_status == "failed" with error_code 131026/131047 → not on WhatsApp
    * delivery_status == "failed" with any other code → system error,
      leave is_whatsapp untouched

    Synchronous wamid responses (see record_send_outcome) are NOT enough,
    because Meta hands out wamids for nearly any well-formed number and
    only fails the send asynchronously.
    """
    try:
        row = ensure_phone_status(db, raw_phone, country=country)
        if row is None:
            return

        now = datetime.now(timezone.utc)
        tail = phone_tail(row.normalized_phone)
        ec = str(error_code) if error_code is not None else None
        ds = (delivery_status or "").lower()
        updated = False

        if ds in ("sent", "delivered", "read"):
            # Meta confirmed delivery to a WhatsApp account — definitive.
            row.is_whatsapp = True
            row.status = ST_AVAILABLE
            row.provider_response_code = ds
            row.provider_error_code = None
            row.provider_error_message = None
            updated = True
        elif ds == "failed" and ec in NOT_ON_WHATSAPP_CODES:
            row.is_whatsapp = False
            row.status = ST_UNAVAILABLE
            row.provider_error_code = ec
            row.provider_error_message = error_message
            updated = True
        elif ds == "failed":
            row.status = ST_ERROR
            row.provider_error_code = ec
            row.provider_error_message = error_message
            updated = True
        else:
            return

        row.last_checked_at = now
        row.next_check_after = _next_check_after(row.status)
        db.commit()
        print(
            f"[wa_availability] delivery callback phone_tail={tail} "
            f"delivery={ds} status={row.status} is_whatsapp={row.is_whatsapp} "
            f"error_code={ec or '-'} updated={updated}"
        )
    except Exception as e:  # noqa: BLE001
        print(f"[wa_availability] record_delivery_outcome failed: {e}")

