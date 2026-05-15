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
    from utils.whatsapp import _send_whatsapp_sync as _send_whatsapp
    try:
        ok = _send_whatsapp(action, phone, params or {})
        if ok:
            print(f"[wa_dispatch] ok action={action} phone={phone[-4:] if phone else '?'}")
        else:
            print(f"[wa_dispatch] failed action={action} phone={phone[-4:] if phone else '?'}")
        return {"ok": bool(ok), "action": action}
    except Exception as exc:  # noqa: BLE001
        print(f"[wa_dispatch] retry action={action}: {exc}")
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
        ok = _send_whatsapp("text", phone, {"message": message})
        return {"ok": bool(ok)}
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
