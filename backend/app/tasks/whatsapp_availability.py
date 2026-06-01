"""
WhatsApp availability Celery tasks
==================================
- check_one_phone(raw_phone, country=None)
    Queue from request-path code whenever a new phone is added.
- enqueue_phones(phones, country=None)
    Convenience batch enqueuer used by bulk imports.
- check_missing_statuses()
    Beat-scheduled. Picks up any rows still in 'unknown'/'checking' status
    and queues per-phone checks.
- refresh_stale_statuses()
    Beat-scheduled. Picks up rows whose next_check_after has elapsed.
- backfill_all_phones()
    Admin-trigger. Scans users/contributors/guests/vendor business phones
    and inserts unique normalized numbers into phone_whatsapp_statuses.

Rate limits are conservative so we don't hammer Meta/the edge function.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import or_, and_

from core.celery_app import celery_app
from core.database import SessionLocal
from models.phone_whatsapp import PhoneWhatsAppStatus
from utils.phone_numbers import normalize_phone, phone_tail
from utils.whatsapp_availability import (
    ensure_phone_status,
    check_whatsapp_availability,
)


_BATCH_LIMIT = 200


# ──────────────────────────────────────────────
# Per-phone check
# ──────────────────────────────────────────────
@celery_app.task(
    name="tasks.whatsapp_availability.check_one_phone",
    rate_limit="60/m",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def check_one_phone(raw_phone: str, country: Optional[str] = None,
                    force: bool = False) -> dict:
    if not raw_phone:
        return {"ok": False, "reason": "empty"}
    db = SessionLocal()
    try:
        result = check_whatsapp_availability(db, raw_phone,
                                             country=country, force=force)
        return {"ok": True, **result}
    finally:
        db.close()


# ──────────────────────────────────────────────
# Batch enqueuer
# ──────────────────────────────────────────────
def enqueue_phones(phones: Iterable[str], country: Optional[str] = None) -> int:
    """Queue check_one_phone for every unique normalizable phone."""
    seen: set[str] = set()
    queued = 0
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
            # ensure a row exists so the frontend sees "unknown" immediately
            ensure_phone_status(db, raw, country=country)
            check_one_phone.delay(n, country)
            queued += 1
    finally:
        db.close()
    return queued


# ──────────────────────────────────────────────
# Beat — scan for unchecked / stale rows
# ──────────────────────────────────────────────
@celery_app.task(name="tasks.whatsapp_availability.check_missing_statuses")
def check_missing_statuses(limit: int = _BATCH_LIMIT) -> dict:
    db = SessionLocal()
    try:
        rows = (
            db.query(PhoneWhatsAppStatus.normalized_phone)
            .filter(PhoneWhatsAppStatus.status.in_(["unknown", "checking"]))
            .filter(PhoneWhatsAppStatus.normalization_status == "ok")
            .order_by(PhoneWhatsAppStatus.created_at.asc())
            .limit(limit)
            .all()
        )
        for (phone,) in rows:
            check_one_phone.delay(phone)
        return {"queued": len(rows)}
    finally:
        db.close()


@celery_app.task(name="tasks.whatsapp_availability.refresh_stale_statuses")
def refresh_stale_statuses(limit: int = _BATCH_LIMIT) -> dict:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        rows = (
            db.query(PhoneWhatsAppStatus.normalized_phone)
            .filter(PhoneWhatsAppStatus.normalization_status == "ok")
            .filter(PhoneWhatsAppStatus.next_check_after.isnot(None))
            .filter(PhoneWhatsAppStatus.next_check_after < now)
            .order_by(PhoneWhatsAppStatus.next_check_after.asc())
            .limit(limit)
            .all()
        )
        for (phone,) in rows:
            check_one_phone.delay(phone, None, True)
        return {"queued": len(rows)}
    finally:
        db.close()


# ──────────────────────────────────────────────
# Backfill — scan every phone field across the platform
# ──────────────────────────────────────────────
@celery_app.task(name="tasks.whatsapp_availability.backfill_all_phones")
def backfill_all_phones(queue_checks: bool = True, limit: int = 5000) -> dict:
    """
    Scan all known phone-bearing tables, insert unique normalized rows into
    phone_whatsapp_statuses, and (optionally) enqueue WhatsApp checks for
    new rows. Skips invalid numbers gracefully.
    """
    db = SessionLocal()
    stats = {"scanned": 0, "inserted": 0, "existing": 0,
             "invalid": 0, "queued": 0}
    try:
        # Lazy imports to avoid models-package import cycles at task start.
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
        for label, primary, secondary in sources:
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
                existing = (
                    db.query(PhoneWhatsAppStatus.id)
                    .filter(PhoneWhatsAppStatus.normalized_phone == n)
                    .first()
                )
                if existing:
                    stats["existing"] += 1
                    continue
                ensure_phone_status(db, raw)
                stats["inserted"] += 1
                if queue_checks:
                    check_one_phone.delay(n)
                    stats["queued"] += 1

        print(f"[wa_availability] backfill done: {stats}")
        return stats
    finally:
        db.close()
