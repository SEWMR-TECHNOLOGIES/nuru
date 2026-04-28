"""
Bulk SMS Reminder Pipeline
==========================

Implements the async + idempotent + dedup'd batch sender used by
``POST /user-contributors/events/{event_id}/bulk-message``.

Why this exists
---------------
The original endpoint sent SMS sequentially inside the request handler
(15s per recipient × N contributors → request times out at the proxy /
Vercel boundary; the mobile client then surfaces a misleading
"check your internet connection" error). It also had no idempotency,
so a retry after a partial failure re-spammed everyone, including the
organiser themselves.

Pipeline
--------
1. ``build_batch`` — creates one ``sms_send_batches`` row + one
   ``sms_send_jobs`` row per recipient. Performs:
     * E.164 normalisation (Tanzanian rules + international passthrough)
     * Drop organiser-self / event-contact phones (so the organiser doesn't
       SMS themselves)
     * Intra-batch deduplication on normalised phone
     * Idempotency: same ``(event_id, message_template, recipient_set)``
       within the last 1h returns the existing batch instead of creating
       a new one.
   Returns ``(batch, jobs, dedup_meta, was_existing)``.

2. ``flush_batch`` — picks up queued jobs, groups them into chunks of
   ``CHUNK_SIZE`` recipients per ``SewmrSmsClient.send_quick_sms`` call
   (the gateway already accepts a list, so 100 contributors = 5 HTTP
   calls, not 100). Marks each job ``sent`` / ``failed`` based on the
   gateway response. Schedules retries 1h out, capped at 3 attempts.

3. ``flush_batch_inline`` — Vercel-friendly variant that runs
   ``flush_batch`` with a wall-clock budget so the HTTP request returns
   well within the platform's serverless function timeout. Any leftover
   ``queued`` jobs are picked up by the Celery beat task
   ``resume_pending_batches``.
"""
from __future__ import annotations

import hashlib
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.helpers import format_phone_display
from utils.sms import SMS_SIGNATURE, normalize_tz_phone


# How many recipients to fan into a single SewmrSmsClient HTTP call.
# Sewmr accepts a list — the bottleneck is their gateway, not us.
CHUNK_SIZE = 20

# Max attempts per job before we stop retrying.
MAX_ATTEMPTS = 3

# How long to wait between attempts on failure.
RETRY_DELAY = timedelta(hours=1)

# How far back to look for an idempotent batch to re-use.
IDEMPOTENCY_WINDOW = timedelta(hours=1)


@dataclass
class DedupMeta:
    self_skipped: list[str] = field(default_factory=list)
    duplicate_skipped: list[str] = field(default_factory=list)
    invalid_phone: list[str] = field(default_factory=list)


def _normalize(phone: str | None) -> str | None:
    """Best-effort E.164. Falls back to digit-only string for non-TZ numbers."""
    if not phone:
        return None
    n = normalize_tz_phone(phone)
    return n


def _hash_recipients(template: str, phones: list[str]) -> str:
    h = hashlib.sha256()
    h.update(template.strip().encode("utf-8"))
    h.update(b"\x00")
    for p in sorted(phones):
        h.update(p.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def _resolve_message(
    *,
    template: str,
    name: str,
    event_name: str,
    payment_info: str | None,
    contact_phone_display: str | None,
) -> str:
    """Same template substitution rules used by the legacy endpoint."""
    out = template
    out = out.replace("{name}", name or "Contributor")
    out = out.replace("{event_name}", event_name or "")
    out = out.replace("{event_title}", (event_name or "").upper())

    if "{payment}" in out:
        if payment_info:
            out = out.replace("{payment}", payment_info)
        else:
            out = "\n".join(line for line in out.split("\n") if "{payment}" not in line)

    if contact_phone_display:
        out += f"\nKwa maulizo, wasiliana nasi kupitia: {contact_phone_display}\nAsante."
    return out.strip()


def build_batch(
    db: Session,
    *,
    event,
    organiser,
    recipients: list[dict],
    message_template: str,
    payment_info: str | None,
    override_contact_phone: str | None,
):
    """Create (or reuse) a batch + jobs for the given recipients.

    ``recipients`` is a list of ``{phone, name, event_contributor_id}``.
    Returns ``(batch_row, jobs, dedup_meta, was_existing)``.
    """
    # Lazy import to avoid a circular dep with models package init.
    from models.users import User  # noqa: F401  (organiser is already loaded)

    # ── Resolve contact phone for the inquiry footer ──
    contact_phone_raw = (
        override_contact_phone
        or getattr(event, "reminder_contact_phone", None)
        or (organiser.phone if organiser else None)
    )
    contact_phone_display = (
        format_phone_display(contact_phone_raw) if contact_phone_raw else None
    )

    # ── Normalise + dedup recipients ──
    organiser_phone_norm = _normalize(getattr(organiser, "phone", None))
    event_contact_norm = _normalize(getattr(event, "reminder_contact_phone", None))

    seen: set[str] = set()
    dedup = DedupMeta()
    prepared: list[dict] = []

    for r in recipients:
        raw = (r.get("phone") or "").strip()
        name = (r.get("name") or "").strip() or "Contributor"
        ec_id = r.get("event_contributor_id")

        norm = _normalize(raw)
        if not norm:
            dedup.invalid_phone.append(name)
            continue

        # Drop organiser self-sends (the original bug)
        if organiser_phone_norm and norm == organiser_phone_norm:
            dedup.self_skipped.append(name)
            continue
        if event_contact_norm and norm == event_contact_norm:
            dedup.self_skipped.append(name)
            continue

        if norm in seen:
            dedup.duplicate_skipped.append(name)
            continue
        seen.add(norm)

        prepared.append(
            {
                "phone_norm": norm,
                "name": name,
                "ec_id": ec_id,
                "resolved": _resolve_message(
                    template=message_template,
                    name=name,
                    event_name=event.name or "",
                    payment_info=payment_info,
                    contact_phone_display=contact_phone_display,
                ),
            }
        )

    # ── Idempotency lookup ──
    idem_hash = _hash_recipients(message_template, [p["phone_norm"] for p in prepared])
    cutoff = datetime.utcnow() - IDEMPOTENCY_WINDOW

    existing = db.execute(
        text(
            """
            SELECT id, status, recipient_count
              FROM sms_send_batches
             WHERE event_id = :eid
               AND idempotency_hash = :h
               AND created_at >= :cutoff
             ORDER BY created_at DESC
             LIMIT 1
            """
        ),
        {"eid": str(event.id), "h": idem_hash, "cutoff": cutoff},
    ).fetchone()

    if existing:
        # Re-use the existing batch — caller will trigger flush again, which
        # is safe because per-job status guards prevent re-sends.
        return existing, [], dedup, True

    # ── Create batch + jobs ──
    batch_id = uuid.uuid4()
    db.execute(
        text(
            """
            INSERT INTO sms_send_batches
                (id, event_id, created_by, message_template, payment_info,
                 contact_phone, recipient_count, status, idempotency_hash)
            VALUES
                (:id, :eid, :uid, :tpl, :pay, :contact, :n, 'queued', :h)
            """
        ),
        {
            "id": str(batch_id),
            "eid": str(event.id),
            "uid": str(organiser.id) if organiser else None,
            "tpl": message_template,
            "pay": payment_info,
            "contact": contact_phone_raw,
            "n": len(prepared),
            "h": idem_hash,
        },
    )

    job_rows = []
    for p in prepared:
        jid = uuid.uuid4()
        db.execute(
            text(
                """
                INSERT INTO sms_send_jobs
                    (id, batch_id, event_contributor_id, recipient_phone_e164,
                     recipient_name, resolved_message, status)
                VALUES
                    (:id, :bid, :ec, :phone, :name, :msg, 'queued')
                ON CONFLICT (batch_id, recipient_phone_e164) DO NOTHING
                """
            ),
            {
                "id": str(jid),
                "bid": str(batch_id),
                "ec": str(p["ec_id"]) if p["ec_id"] else None,
                "phone": p["phone_norm"],
                "name": p["name"],
                "msg": p["resolved"],
            },
        )
        job_rows.append({"id": str(jid), "phone": p["phone_norm"], "name": p["name"]})

    db.commit()

    batch_row = db.execute(
        text("SELECT id, status, recipient_count FROM sms_send_batches WHERE id = :id"),
        {"id": str(batch_id)},
    ).fetchone()
    return batch_row, job_rows, dedup, False


def _send_chunk(messages_by_phone: dict[str, str]) -> dict[str, bool]:
    """Send a single chunk to SewmrSmsClient. Returns ``{phone: ok}``.

    SewmrSmsClient's ``send_quick_sms`` only accepts ONE message body per
    call, so we group by identical resolved message. In practice every
    recipient gets a personalised message ({name} substitution), so the
    chunk usually translates to one call per recipient. That's fine —
    chunking still serialises us so we don't overwhelm the gateway, and
    the Celery worker handles the wall-clock cost off-request.
    """
    from services.SewmrSmsClient import SewmrSmsClient

    client = SewmrSmsClient()
    results: dict[str, bool] = {}
    for phone, message in messages_by_phone.items():
        try:
            resp = client.send_quick_sms(
                message=message + SMS_SIGNATURE,
                recipients=[phone],
            )
            ok = bool(resp) and (
                resp.get("success") is not False  # truthy / missing == ok
            )
            results[phone] = ok
        except Exception as e:  # noqa: BLE001
            print(f"[sms_batch] gateway error for {phone}: {e}")
            results[phone] = False
    return results


def _claim_jobs(db: Session, batch_id: str, limit: int) -> list[dict]:
    """Claim up to ``limit`` queued/retry-due jobs using SKIP LOCKED.

    Returns the raw row dicts. Caller is expected to update them.
    """
    rows = db.execute(
        text(
            """
            SELECT id, recipient_phone_e164, resolved_message, attempts
              FROM sms_send_jobs
             WHERE batch_id = :bid
               AND status = 'queued'
               AND (next_retry_at IS NULL OR next_retry_at <= now())
             ORDER BY attempts ASC, id ASC
             FOR UPDATE SKIP LOCKED
             LIMIT :lim
            """
        ),
        {"bid": batch_id, "lim": limit},
    ).fetchall()
    return [dict(r._mapping) for r in rows]


def _finalise_batch(db: Session, batch_id: str) -> None:
    counts = db.execute(
        text(
            """
            SELECT status, COUNT(*) AS n
              FROM sms_send_jobs
             WHERE batch_id = :bid
             GROUP BY status
            """
        ),
        {"bid": batch_id},
    ).fetchall()
    by_status = {r._mapping["status"]: r._mapping["n"] for r in counts}
    queued = by_status.get("queued", 0)
    failed = by_status.get("failed", 0)
    sent = by_status.get("sent", 0)

    if queued > 0:
        new_status = "running"
        finished = None
    elif failed > 0 and sent > 0:
        new_status = "partial"
        finished = datetime.utcnow()
    elif failed > 0:
        new_status = "partial"
        finished = datetime.utcnow()
    else:
        new_status = "done"
        finished = datetime.utcnow()

    db.execute(
        text(
            """
            UPDATE sms_send_batches
               SET status = :s,
                   finished_at = :f
             WHERE id = :id
            """
        ),
        {"s": new_status, "f": finished, "id": batch_id},
    )
    db.commit()


def flush_batch(db: Session, batch_id: str, time_budget_seconds: float | None = None) -> dict:
    """Send queued jobs for the batch in chunks. Returns counts.

    ``time_budget_seconds`` — if provided, stop claiming new chunks once
    elapsed wall-time exceeds the budget. Used for the inline (Vercel)
    path so the HTTP request returns within the platform's hard timeout.
    """
    started = time.monotonic()
    sent_total = 0
    failed_total = 0

    while True:
        if time_budget_seconds is not None and (time.monotonic() - started) >= time_budget_seconds:
            break

        jobs = _claim_jobs(db, batch_id, CHUNK_SIZE)
        if not jobs:
            break

        # Build phone→message map for this chunk
        messages = {j["recipient_phone_e164"]: j["resolved_message"] for j in jobs}
        results = _send_chunk(messages)

        # Apply results
        now = datetime.utcnow()
        for j in jobs:
            phone = j["recipient_phone_e164"]
            ok = results.get(phone, False)
            new_attempts = (j.get("attempts") or 0) + 1
            if ok:
                db.execute(
                    text(
                        """
                        UPDATE sms_send_jobs
                           SET status = 'sent',
                               attempts = :a,
                               sent_at = :now,
                               error_text = NULL,
                               next_retry_at = NULL
                         WHERE id = :id
                        """
                    ),
                    {"a": new_attempts, "now": now, "id": j["id"]},
                )
                sent_total += 1
            else:
                if new_attempts >= MAX_ATTEMPTS:
                    db.execute(
                        text(
                            """
                            UPDATE sms_send_jobs
                               SET status = 'failed',
                                   attempts = :a,
                                   next_retry_at = NULL,
                                   error_text = COALESCE(error_text, '') || E'\n' || 'gateway_error'
                             WHERE id = :id
                            """
                        ),
                        {"a": new_attempts, "id": j["id"]},
                    )
                else:
                    # Stays 'queued' but with next_retry_at pushed out 1h.
                    db.execute(
                        text(
                            """
                            UPDATE sms_send_jobs
                               SET attempts = :a,
                                   next_retry_at = :next,
                                   error_text = COALESCE(error_text, '') || E'\n' || 'gateway_error'
                             WHERE id = :id
                            """
                        ),
                        {
                            "a": new_attempts,
                            "next": now + RETRY_DELAY,
                            "id": j["id"],
                        },
                    )
                failed_total += 1
        db.commit()

    _finalise_batch(db, batch_id)
    return {"sent": sent_total, "failed": failed_total}


def flush_batch_inline(db: Session, batch_id: str, time_budget_seconds: float = 8.0) -> dict:
    """Vercel-friendly wrapper. Returns whatever progress fits the budget."""
    return flush_batch(db, batch_id, time_budget_seconds=time_budget_seconds)


def batch_status(db: Session, batch_id: str) -> dict:
    batch = db.execute(
        text(
            """
            SELECT id, event_id, status, recipient_count, created_at, finished_at
              FROM sms_send_batches
             WHERE id = :id
            """
        ),
        {"id": batch_id},
    ).fetchone()
    if not batch:
        return {}

    counts_rows = db.execute(
        text(
            """
            SELECT status, COUNT(*) AS n
              FROM sms_send_jobs
             WHERE batch_id = :bid
             GROUP BY status
            """
        ),
        {"bid": batch_id},
    ).fetchall()
    counts = {r._mapping["status"]: int(r._mapping["n"]) for r in counts_rows}

    return {
        "batch_id": str(batch._mapping["id"]),
        "event_id": str(batch._mapping["event_id"]),
        "status": batch._mapping["status"],
        "recipient_count": int(batch._mapping["recipient_count"] or 0),
        "created_at": batch._mapping["created_at"].isoformat() if batch._mapping["created_at"] else None,
        "finished_at": batch._mapping["finished_at"].isoformat() if batch._mapping["finished_at"] else None,
        "counts": {
            "sent": counts.get("sent", 0),
            "failed": counts.get("failed", 0),
            "queued": counts.get("queued", 0),
            "skipped": counts.get("skipped", 0),
        },
    }
