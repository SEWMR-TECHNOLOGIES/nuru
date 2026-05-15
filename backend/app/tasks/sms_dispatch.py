"""
Task: Bulk SMS reminder dispatch
================================
Owns the worker side of the ``sms_send_batches``/``sms_send_jobs`` pipeline
defined in ``utils/sms_batch.py``.

* ``send_batch(batch_id)`` is enqueued by the bulk-message endpoint when
  Celery+Redis are available. It opens its own DB session, calls
  ``flush_batch`` (no time budget — it can take as long as needed), and
  retries on unexpected exceptions.

* ``resume_pending_batches()`` runs on a beat schedule (every 5 min). It
  picks up any batch that still has ``queued`` jobs whose ``next_retry_at``
  is due (or NULL) and re-flushes it. This is what catches:
    - Vercel inline runs that timed out before completing all chunks
    - Failed jobs that hit ``next_retry_at = now() + 1h`` and are due again
"""
from sqlalchemy import text

from core.celery_app import celery_app
from core.database import SessionLocal


@celery_app.task(
    name="tasks.sms_dispatch.send_batch",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    rate_limit="10/m",
)
def send_batch(self, batch_id: str):
    """Worker entry point for a freshly created batch."""
    from utils.sms_batch import flush_batch

    db = SessionLocal()
    try:
        return flush_batch(db, batch_id)
    except Exception as exc:  # noqa: BLE001
        try:
            db.rollback()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(name="tasks.sms_dispatch.resume_pending_batches")
def resume_pending_batches():
    """Pick up batches with leftover work and flush them.

    Looks at the cheap index on ``sms_send_jobs(status, next_retry_at)``
    so this stays inexpensive even at scale.
    """
    from utils.sms_batch import flush_batch

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT DISTINCT batch_id
                  FROM sms_send_jobs
                 WHERE status = 'queued'
                   AND (next_retry_at IS NULL OR next_retry_at <= now())
                 LIMIT 50
                """
            )
        ).fetchall()
        batch_ids = [str(r._mapping["batch_id"]) for r in rows]
    finally:
        db.close()

    for bid in batch_ids:
        try:
            send_batch.delay(bid)
        except Exception as e:  # noqa: BLE001
            print(f"[sms_dispatch] failed to enqueue resume for {bid}: {e}")

    return {"resumed": len(batch_ids)}


# ──────────────────────────────────────────────────────────────────────────
# Single-recipient transactional SMS
# ──────────────────────────────────────────────────────────────────────────
# Used by ``utils.sms._send`` (and every ``sms_*`` helper that wraps it) so
# routes never block on the SewmrSMS HTTP call. The bulk pipeline above
# (``send_batch`` + ``sms_send_jobs``) is still preferred for >1 recipient
# because it carries idempotency + retry state in the database.

@celery_app.task(
    name="tasks.sms_dispatch.send_one",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    rate_limit="300/m",
)
def send_one(self, phone: str, message: str):
    """Send a single SMS via the SewmrSMS gateway."""
    from services.SewmrSmsClient import SewmrSmsClient
    from utils.sms import normalize_tz_phone, SMS_SIGNATURE
    normalized = normalize_tz_phone(phone)
    if not normalized:
        print(f"[sms_dispatch] skip — unparseable phone {phone!r}")
        return {"ok": False, "skipped": True}
    try:
        client = SewmrSmsClient()
        result = client.send_quick_sms(
            message=(message or "") + SMS_SIGNATURE,
            recipients=[normalized],
        )
        ok = bool(result.get("success"))
        if ok:
            print(f"[sms_dispatch] ok phone={normalized[-4:]}")
        else:
            print(f"[sms_dispatch] failed phone={normalized[-4:]} err={result.get('error')}")
        return {"ok": ok}
    except Exception as exc:  # noqa: BLE001
        print(f"[sms_dispatch] retry phone={normalized[-4:]}: {exc}")
        raise self.retry(exc=exc)
