"""
Task: Async WhatsApp dispatch
=============================
Moves blocking calls to the WhatsApp Cloud API (graph.facebook.com) out of
the request lifecycle. Every ``wa_*`` helper in :mod:`utils.whatsapp` now
enqueues one of these tasks instead of calling ``requests.post`` inline.

Workers retry transient provider failures up to 3 times and never crash the
caller — failures are logged with a structured ``[wa_dispatch]`` prefix.
"""
from core.celery_app import celery_app


@celery_app.task(
    name="tasks.whatsapp_dispatch.send_action",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    rate_limit="120/m",
)
def send_action(self, action: str, phone: str, params: dict):
    """Generic WhatsApp send. ``action`` matches the edge-function dispatcher
    keys (e.g. ``"text"``, ``"invite"``, ``"contribution_recorded"``)."""
    from utils.whatsapp import _send_whatsapp_sync as _send_whatsapp, _normalize_phone, _mask_phone
    from utils.whatsapp_availability import record_send_outcome
    from core.database import SessionLocal
    tail = _mask_phone(_normalize_phone(phone or ""))
    try:
        result = _send_whatsapp(action, phone, params or {})
        if not isinstance(result, dict):
            result = {"ok": bool(result)}
        # Opportunistically learn the recipient's WhatsApp status from this
        # real send — no extra Meta API call needed.
        try:
            if phone:
                db = SessionLocal()
                try:
                    if result.get("ok") and result.get("message_id"):
                        record_send_outcome(db, phone, delivered=True)
                    elif result.get("not_on_whatsapp"):
                        record_send_outcome(db, phone, delivered=False, not_on_whatsapp=True)
                finally:
                    db.close()
        except Exception as _e:  # noqa: BLE001
            print(f"[wa_dispatch] record_send_outcome skipped: {_e}")

        if result.get("ok") and result.get("message_id"):
            print(f"[wa_dispatch] ok action={action} phone_tail={tail} wamid={result.get('message_id')}")
            return {"ok": True, "action": action, "message_id": result.get("message_id")}
        print(
            f"[wa_dispatch] failed action={action} phone_tail={tail} "
            f"status={result.get('status')} not_on_whatsapp={result.get('not_on_whatsapp')} "
            f"error={(result.get('error') or '')[:200]}"
        )
        return {"ok": False, "action": action, **{k: v for k, v in result.items() if k != 'ok'}}
    except Exception as exc:  # noqa: BLE001
        print(f"[wa_dispatch] retry action={action} phone_tail={tail}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="tasks.whatsapp_dispatch.send_text",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    rate_limit="120/m",
)
def send_text(self, phone: str, message: str):
    """Plain WhatsApp text (24h conversation window only)."""
    from utils.whatsapp import _send_whatsapp_sync as _send_whatsapp
    try:
        result = _send_whatsapp("text", phone, {"message": message})
        ok = bool(result.get("ok")) if isinstance(result, dict) else bool(result)
        return {"ok": ok}
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc)


@celery_app.task(name="tasks.whatsapp_dispatch.send_bulk")
def send_bulk(items: list):
    """Fan-out a batch of (action, phone, params) tuples — one Celery task
    per recipient so failures don't block the rest."""
    enqueued = 0
    for it in items or []:
        try:
            action = it.get("action", "text")
            phone = it.get("phone")
            params = it.get("params") or {}
            if not phone:
                continue
            send_action.delay(action, phone, params)
            enqueued += 1
        except Exception as e:  # noqa: BLE001
            print(f"[wa_dispatch] skip bulk item: {e}")
    return {"enqueued": enqueued}
