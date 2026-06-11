"""
Task: Async WhatsApp dispatch
=============================
Moves blocking calls to the WhatsApp Cloud API (graph.facebook.com) out of
the request lifecycle. Every ``wa_*`` helper in :mod:`utils.whatsapp` now
enqueues one of these tasks instead of calling ``requests.post`` inline.

After every real send we feed the result into
``utils.whatsapp_availability.record_send_outcome`` so we learn each
recipient's WhatsApp availability naturally — without ever sending a
hello_world or silent probe.
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

        # Opportunistic learner — uses the real provider response. No probe.
        try:
            if phone:
                db = SessionLocal()
                try:
                    if result.get("ok") and result.get("message_id"):
                        record_send_outcome(
                            db, phone,
                            message_id=str(result.get("message_id")),
                            action=action,
                        )
                    elif result.get("not_on_whatsapp"):
                        record_send_outcome(
                            db, phone,
                            not_on_whatsapp=True,
                            error_code=str(result.get("error_code") or "131026"),
                            error_message=(result.get("error") or "recipient not on WhatsApp"),
                            action=action,
                        )
                    elif not result.get("ok"):
                        # Provider/system error — don't punish the phone.
                        record_send_outcome(
                            db, phone,
                            error_code=str(result.get("error_code") or result.get("status") or ""),
                            error_message=(result.get("error") or "send failed"),
                            action=action,
                        )
                finally:
                    db.close()
        except Exception as _e:  # noqa: BLE001
            print(f"[wa_dispatch] record_send_outcome skipped: {_e}")

        # Mirror outbound template/text sends into wa_conversations + wa_messages
        # so admins can see them (and their delivery status) in /admin/whatsapp.
        try:
            if phone and result.get("ok") and result.get("message_id"):
                from api.routes.whatsapp_admin import _store_incoming
                db = SessionLocal()
                try:
                    from utils.whatsapp import _whatsapp_admin_summary
                    summary = _whatsapp_admin_summary(action, params or {})
                    image_url = (
                        params.get("image_url")
                        or params.get("media_url")
                        or params.get("header_image")
                    )
                    _store_incoming(
                        db, phone=phone, content=str(summary)[:1000],
                        wa_message_id=str(result.get("message_id")),
                        contact_name=str(params.get("guest_name") or params.get("contributor_name") or params.get("name") or ""),
                        direction="outbound",
                        media_url=str(image_url) if image_url else None,
                        media_type="image" if image_url else None,
                    )
                finally:
                    db.close()
        except Exception as _e:  # noqa: BLE001
            print(f"[wa_dispatch] mirror outbound skipped: {_e}")


        if result.get("ok") and result.get("message_id"):
            print(
                f"[wa_dispatch] ok action={action} phone_tail={tail} "
                f"wamid={result.get('message_id')}"
            )
            return {"ok": True, "action": action, "message_id": result.get("message_id")}
        print(
            f"[wa_dispatch] failed action={action} phone_tail={tail} "
            f"status={result.get('status')} not_on_whatsapp={result.get('not_on_whatsapp')} "
            f"error_code={result.get('error_code')} error={(result.get('error') or '')[:200]}"
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
    from utils.whatsapp_availability import record_send_outcome
    from core.database import SessionLocal
    try:
        result = _send_whatsapp("text", phone, {"message": message})
        ok = bool(result.get("ok")) if isinstance(result, dict) else bool(result)
        try:
            if phone and isinstance(result, dict):
                db = SessionLocal()
                try:
                    if ok and result.get("message_id"):
                        record_send_outcome(db, phone,
                                            message_id=str(result.get("message_id")),
                                            action="text")
                    elif result.get("not_on_whatsapp"):
                        record_send_outcome(db, phone, not_on_whatsapp=True,
                                            error_code=str(result.get("error_code") or "131026"),
                                            action="text")
                finally:
                    db.close()
        except Exception as _e:  # noqa: BLE001
            print(f"[wa_dispatch] record_send_outcome skipped: {_e}")
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
