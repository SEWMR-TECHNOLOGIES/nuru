"""
WhatsApp availability Celery tasks
==================================
POLICY: We do NOT actively probe Meta. There is no silent WhatsApp lookup
and we refuse to spam users with `hello_world` or any other template just
to learn their availability. Availability is learned opportunistically
from real Nuru sends — see ``utils.whatsapp_availability.record_send_outcome``.

What stays here:
  - enqueue_phones(...)        seeds cache rows ("unknown") for a batch of phones
  - backfill_all_phones(...)   admin trigger — scans every phone field and
                               inserts unique normalized rows as "unknown".
                               Never sends WhatsApp messages.

What was removed:
  - check_one_phone            (was: send hello_world to learn status)
  - check_missing_statuses     (was: beat-scheduled probe sweep)
  - refresh_stale_statuses     (was: beat-scheduled probe refresh)

Stubs for the removed names are kept so old beat configs / imports don't
crash; they simply log and exit.
"""
from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy import or_

from core.celery_app import celery_app
from core.database import SessionLocal
from utils.phone_numbers import normalize_phone
from utils.whatsapp_availability import ensure_phone_status


# ──────────────────────────────────────────────
# Seeder — no provider calls, ever
# ──────────────────────────────────────────────
def enqueue_phones(phones: Iterable[str], country: Optional[str] = None) -> int:
    """Insert "unknown" cache rows for every unique normalizable phone.

    Does NOT send any WhatsApp messages. Availability will be learned
    later from real Nuru sends to these numbers.
    """
    seen: set[str] = set()
    seeded = 0
    db = SessionLocal()
    try:
        for raw in phones:
            if not raw:
                continue
            norm = normalize_phone(raw, country=country)
            if not norm.get("ok"):
                continue
            n = norm["normalized"]
            if n in seen:
                continue
            seen.add(n)
            ensure_phone_status(db, raw, country=country)
            seeded += 1
    finally:
        db.close()
    return seeded


# ──────────────────────────────────────────────
# Disabled stubs (kept for backwards compatibility)
# ──────────────────────────────────────────────
@celery_app.task(name="tasks.whatsapp_availability.check_one_phone")
def check_one_phone(raw_phone: str, country: Optional[str] = None,
                    force: bool = False) -> dict:  # noqa: ARG001
    """Disabled. Only seeds the cache row — never sends a probe."""
    if not raw_phone:
        return {"ok": False, "reason": "empty"}
    db = SessionLocal()
    try:
        ensure_phone_status(db, raw_phone, country=country)
    finally:
        db.close()
    return {"ok": True, "probed": False, "reason": "active probing disabled"}


@celery_app.task(name="tasks.whatsapp_availability.check_missing_statuses")
def check_missing_statuses(limit: int = 0) -> dict:  # noqa: ARG001
    print("[wa_availability] check_missing_statuses skipped — active probing disabled")
    return {"queued": 0, "disabled": True}


@celery_app.task(name="tasks.whatsapp_availability.refresh_stale_statuses")
def refresh_stale_statuses(limit: int = 0) -> dict:  # noqa: ARG001
    print("[wa_availability] refresh_stale_statuses skipped — active probing disabled")
    return {"queued": 0, "disabled": True}


# ──────────────────────────────────────────────
# Backfill — seed unknown rows for every known phone field
# ──────────────────────────────────────────────
@celery_app.task(name="tasks.whatsapp_availability.backfill_all_phones")
def backfill_all_phones(queue_checks: bool = False,  # noqa: ARG001
                        limit: int = 5000) -> dict:
    """
    Scan all known phone-bearing tables and insert unique normalized rows
    into phone_whatsapp_statuses with status='unknown'. Never sends
    WhatsApp messages — ``queue_checks`` is accepted for compatibility but
    always ignored.
    """
    db = SessionLocal()
    stats = {"scanned": 0, "inserted": 0, "existing": 0,
             "invalid": 0, "queued": 0, "probed": False}
    try:
        from models import (
            User, UserContributor, EventContributor, AttendeeProfile,
            EventGuestPlusOne, EventCommitteeMember, ServiceBusinessPhone,
        )

        sources = []

        def _add(rows, label):
            for r in rows:
                phone = getattr(r, "phone", None) or getattr(r, "phone_number", None)
                sources.append((label, phone, getattr(r, "secondary_phone", None)))

        _add(db.query(User).filter(User.phone.isnot(None)).limit(limit).all(), "user")
        _add(db.query(UserContributor).filter(
            or_(UserContributor.phone.isnot(None),
                UserContributor.secondary_phone.isnot(None))
        ).limit(limit).all(), "user_contributor")
        _add(db.query(EventContributor).filter(
            or_(EventContributor.phone.isnot(None),
                EventContributor.secondary_phone.isnot(None))
        ).limit(limit).all(), "event_contributor")
        try:
            _add(db.query(AttendeeProfile).filter(
                AttendeeProfile.phone.isnot(None)
            ).limit(limit).all(), "attendee")
        except Exception:
            pass
        try:
            _add(db.query(EventGuestPlusOne).filter(
                EventGuestPlusOne.phone.isnot(None)
            ).limit(limit).all(), "guest_plus_one")
        except Exception:
            pass
        try:
            _add(db.query(EventCommitteeMember).filter(
                EventCommitteeMember.phone.isnot(None)
            ).limit(limit).all(), "committee")
        except Exception:
            pass
        try:
            _add(db.query(ServiceBusinessPhone).all(), "service_business_phone")
        except Exception:
            pass

        seen: set[str] = set()
        for _label, primary, secondary in sources:
            for raw in (primary, secondary):
                if not raw:
                    continue
                stats["scanned"] += 1
                norm = normalize_phone(raw)
                if not norm.get("ok"):
                    stats["invalid"] += 1
                    continue
                n = norm["normalized"]
                if n in seen:
                    continue
                seen.add(n)
                # ensure_phone_status returns the row whether it pre-existed
                # or was just inserted; we don't need to discriminate here.
                ensure_phone_status(db, raw)
                stats["inserted"] += 1

        print(f"[wa_availability] backfill done (no probing): {stats}")
        return stats
    finally:
        db.close()
