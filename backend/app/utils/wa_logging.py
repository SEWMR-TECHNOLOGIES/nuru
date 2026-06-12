"""
WhatsApp message log helpers
============================
One central place to write to the ``wa_message_logs`` table from the
WhatsApp send pipeline and from the Meta webhook receiver. Deliberately
defensive: every helper opens/closes its own DB session and swallows
errors so logging can never break the actual send.

What gets captured:
  • base attempt (recipient, action, template, params, summary)
  • event linkage + recipient typing (set by the route via
    ``set_wa_log_context`` OR per-call via ``meta=``)
  • provider response → status / wamid / error code / fbtrace_id /
    WhatsApp availability tri-state
  • Meta webhook callbacks → delivery timeline + failure detail
  • SMS-fallback bookkeeping → did we try SMS, did it succeed
"""
from __future__ import annotations

import contextvars
import json
import uuid as _uuid
from datetime import datetime
from typing import Any

# ----------------------------------------------------------------------
# Ambient send context
# ----------------------------------------------------------------------
# Filled by the request middleware (user_id) or explicitly by routes
# that know they're triggering event-related messaging. Per-recipient
# fields can also be overridden with ``meta=`` on the send call.
_wa_log_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_user_id", default=None)
_wa_log_event_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_event_id", default=None)
_wa_log_event_name: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_event_name", default=None)
_wa_log_purpose: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_purpose", default=None)
_wa_log_source_module: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_source_module", default=None)
_wa_log_recipient_type: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_recipient_type", default=None)
_wa_log_related_entity_type: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_related_entity_type", default=None)
_wa_log_related_entity_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "wa_log_related_entity_id", default=None)


def set_wa_log_context(
    user_id=None,
    event_id=None,
    *,
    event_name=None,
    purpose=None,
    source_module=None,
    recipient_type=None,
    related_entity_type=None,
    related_entity_id=None,
) -> None:
    """Attribute subsequent log_attempt() calls in this context.

    Any field can be omitted — only the ones passed are overwritten.
    """
    try:
        if user_id is not None:
            _wa_log_user_id.set(str(user_id))
        if event_id is not None:
            _wa_log_event_id.set(str(event_id))
        if event_name is not None:
            _wa_log_event_name.set(str(event_name))
        if purpose is not None:
            _wa_log_purpose.set(str(purpose))
        if source_module is not None:
            _wa_log_source_module.set(str(source_module))
        if recipient_type is not None:
            _wa_log_recipient_type.set(str(recipient_type))
        if related_entity_type is not None:
            _wa_log_related_entity_type.set(str(related_entity_type))
        if related_entity_id is not None:
            _wa_log_related_entity_id.set(str(related_entity_id))
    except Exception:  # noqa: BLE001
        pass


def _uuid_or_none(value) -> str | None:
    try:
        return str(_uuid.UUID(str(value))) if value else None
    except Exception:  # noqa: BLE001
        return None


# Categorise an outgoing action into a high-level message category for
# tab filters in the UI.
_CATEGORY_MAP = {
    "guest_invitation": "invitation",
    "send_invitation_text": "invitation",
    "send_invitation_card": "invitation_card",
    "invitation_card_message": "invitation_card",

    "otp": "otp",
    "otp_login": "otp",
    "otp_signup": "otp",
    "password_reset": "password_reset",
    "welcome_registered_by": "account_setup",

    "contribution_recorded": "contribution",
    "contribution_recorded_with_balance": "contribution",
    "contribution_recorded_pledge_complete": "contribution",
    "contribution_target_set": "contribution",
    "contribution_target_updated": "contribution",
    "contribution_thank_you": "contribution",
    "pledge_thank_you_card": "contribution",
    "guest_contribution_invite": "contribution",
    "guest_contribution_receipt": "contribution",
    "organiser_contribution_received": "contribution",

    "committee_invite": "committee",
    "meeting_invitation": "meeting",

    "ticket_purchased": "ticket",
    "ticket_transferred": "ticket",

    "payment_received_generic": "payment",
    "payment_confirmation_payer": "payment",
    "admin_payment_alert": "payment",
    "vendor_booking_paid": "vendor_booking",
    "vendor_confirmation_receipt": "vendor_booking",
    "vendor_confirmation_receipt_full": "vendor_booking",
    "organiser_committee_vendor_confirmed": "vendor_booking",

    "service_booking_notification": "vendor_booking",
    "booking_accepted": "vendor_booking",

    "expense_recorded": "expense",
    "reminder": "reminder",
    "text": "text",
}

# Default purpose per action when route doesn't override.
_PURPOSE_MAP = {
    "guest_invitation": "invitation_message",
    "send_invitation_text": "invitation_message",
    "invitation_card_message": "invitation_card",
    "send_invitation_card": "invitation_card",
    "pledge_thank_you_card": "thank_you_card",
    "contribution_thank_you": "thank_you_message",
    "contribution_recorded": "contribution_receipt",
    "contribution_recorded_with_balance": "contribution_receipt",
    "contribution_recorded_pledge_complete": "contribution_receipt",
    "contribution_target_set": "contribution_target",
    "contribution_target_updated": "contribution_target",
    "guest_contribution_invite": "contribution_invite",
    "guest_contribution_receipt": "contribution_receipt",
    "organiser_contribution_received": "organiser_alert",
    "committee_invite": "committee_invitation",
    "meeting_invitation": "meeting_invitation",
    "ticket_purchased": "ticket_receipt",
    "ticket_transferred": "ticket_transfer",
    "payment_received_generic": "payment_confirmation",
    "payment_confirmation_payer": "payment_confirmation",
    "admin_payment_alert": "admin_alert",
    "vendor_booking_paid": "vendor_payment",
    "vendor_confirmation_receipt": "vendor_receipt",
    "vendor_confirmation_receipt_full": "vendor_receipt",
    "organiser_committee_vendor_confirmed": "vendor_confirmed_alert",
    "service_booking_notification": "booking_request",
    "booking_accepted": "booking_accepted",
    "expense_recorded": "expense_notification",
    "reminder": "event_reminder",
    "welcome_registered_by": "account_setup",
    "text": "free_text",
}


_HUMAN_ERRORS = {
    "131026": "Recipient is not on WhatsApp.",
    "131047": "More than 24 hours since the user's last message — a template is required.",
    "131051": "Unsupported message type.",
    "131056": "Pair rate limit reached for this phone number.",
    "131053": "Image rejected — convert PNG to JPG and try again.",
    "132000": "Template parameter count mismatch.",
    "132001": "Template does not exist in the chosen language.",
    "132005": "Translated text too long for the template.",
    "132007": "Template is paused due to low quality.",
    "132012": "Template parameter format is invalid.",
    "132015": "Template is paused.",
    "132016": "Template is disabled.",
    "133010": "Phone number is not registered with WhatsApp Business.",
    "1":      "Meta-side error — typically WhatsApp Business account billing or template review.",
    "2":      "Temporary Meta API outage — try again shortly.",
    "470":    "Message failed because more than 24 hours have passed since the customer last replied.",
}

# Codes that genuinely mean "this phone is not reachable on WhatsApp".
# IMPORTANT: 131053 is a *media upload/rejection* error (e.g. PNG with alpha,
# image too big). It says nothing about whether the recipient is on WhatsApp,
# so it MUST NOT mark the number as unreachable — doing so was hiding people
# from invitation lists even when their number was perfectly valid.
_NOT_ON_WA_CODES = {"131026", "133010"}


def _category_for(action: str) -> str:
    if not action:
        return "system"
    a = action.lower()
    if a in _CATEGORY_MAP:
        return _CATEGORY_MAP[a]
    if "otp" in a: return "otp"
    if "ticket" in a: return "ticket"
    if "invitation" in a: return "invitation"
    if "contribution" in a or "pledge" in a: return "contribution"
    if "vendor" in a or "booking" in a: return "vendor_booking"
    if "committee" in a: return "committee"
    if "meeting" in a: return "meeting"
    if "payment" in a: return "payment"
    if "reminder" in a: return "reminder"
    return "template"


def _purpose_for(action: str) -> str | None:
    if not action:
        return None
    return _PURPOSE_MAP.get(action.lower()) or None


def _message_type_for(action: str, params: dict) -> str:
    if action == "text":
        return "text"
    has_image = bool((params or {}).get("image_url") or (params or {}).get("media_url"))
    if has_image:
        return "media"
    return "template"


def _safe_jsonable(value: Any) -> Any:
    try:
        json.dumps(value, default=str)
        return value
    except Exception:
        try:
            return json.loads(json.dumps(value, default=str))
        except Exception:
            return {"_repr": repr(value)[:2000]}


def _normalize_phone(phone: str) -> str:
    try:
        from utils.whatsapp import _normalize_phone as _n
        return _n(phone or "")
    except Exception:
        return (phone or "").strip()


def _humanize(error_code: str | None, error_message: str | None,
              not_on_whatsapp: bool = False) -> str | None:
    if not_on_whatsapp:
        return "Recipient is not on WhatsApp."
    if error_code and str(error_code) in _HUMAN_ERRORS:
        return _HUMAN_ERRORS[str(error_code)]
    if error_message:
        return str(error_message)[:500]
    return None


# ----------------------------------------------------------------------
# Public helpers
# ----------------------------------------------------------------------

def log_attempt(
    action: str,
    phone: str,
    params: dict | None,
    *,
    parent_log_id: str | None = None,
    retry_count: int = 0,
    user_id: str | None = None,
    event_id: str | None = None,
    meta: dict | None = None,
) -> str | None:
    """Insert a queued attempt row. Returns the new log id (str), or None.

    ``meta`` overrides ambient context for fields like recipient_type,
    recipient_id, recipient_name, purpose, source_module, event_id,
    event_name. Pass it when you know per-recipient detail (e.g. a
    contributor row, a guest row).
    """
    try:
        from core.database import SessionLocal
        from models.wa_message_log import WAMessageLog
    except Exception as e:  # noqa: BLE001
        print(f"[wa_log] import failed: {e}")
        return None

    params = params or {}
    meta = meta or {}
    db = SessionLocal()
    try:
        category = _category_for(action)
        msg_type = _message_type_for(action, params)
        media_url = params.get("image_url") or params.get("media_url") or params.get("header_image")
        summary = None
        try:
            from utils.whatsapp import _whatsapp_admin_summary
            summary = _whatsapp_admin_summary(action, params)
        except Exception:
            summary = action

        # Recipient display name — explicit meta wins, else common params.
        recipient_name = (
            meta.get("recipient_name")
            or params.get("recipient_name")
            or params.get("guest_name")
            or params.get("contributor_name")
            or params.get("full_name")
            or params.get("user_name")
            or params.get("contact_name")
            or params.get("vendor_name")
            or params.get("name")
        )
        if recipient_name is not None:
            recipient_name = str(recipient_name).strip()[:255] or None

        # Identity / event attribution — explicit > meta > ambient context.
        uid = _uuid_or_none(user_id) or _uuid_or_none(_wa_log_user_id.get())
        eid = (
            _uuid_or_none(event_id)
            or _uuid_or_none(meta.get("event_id"))
            or _uuid_or_none(_wa_log_event_id.get())
        )
        event_name_snap = (
            meta.get("event_name_snapshot")
            or meta.get("event_name")
            or params.get("event_name")
            or _wa_log_event_name.get()
        )
        if event_name_snap:
            event_name_snap = str(event_name_snap)[:255]

        purpose = (
            meta.get("message_purpose")
            or meta.get("purpose")
            or _wa_log_purpose.get()
            or _purpose_for(action)
        )
        source_module = meta.get("source_module") or _wa_log_source_module.get()
        recipient_type = meta.get("recipient_type") or _wa_log_recipient_type.get()
        recipient_id = _uuid_or_none(meta.get("recipient_id"))
        related_entity_type = (
            meta.get("related_entity_type") or _wa_log_related_entity_type.get()
        )
        related_entity_id = _uuid_or_none(
            meta.get("related_entity_id") or _wa_log_related_entity_id.get()
        )

        row = WAMessageLog(
            recipient_phone=str(phone)[:32],
            recipient_name=recipient_name,
            normalized_phone=_normalize_phone(phone)[:32] or None,
            user_id=uid,
            event_id=eid,
            event_name_snapshot=event_name_snap,
            recipient_type=(recipient_type[:32] if recipient_type else None),
            recipient_id=recipient_id,
            message_purpose=(str(purpose)[:128] if purpose else None),
            source_module=(str(source_module)[:64] if source_module else None),
            related_entity_type=(str(related_entity_type)[:64] if related_entity_type else None),
            related_entity_id=related_entity_id,
            category=category,
            action=action,
            template_name=action if msg_type in ("template", "media") else None,
            message_type=msg_type,
            language=str(params.get("lang") or "")[:8] or None,
            request_payload=_safe_jsonable({"action": action, "params": params, "meta": meta}),
            summary=(summary or "")[:1000] or None,
            media_url=str(media_url) if media_url else None,
            media_type="image" if media_url else None,
            status="queued",
            retry_count=int(retry_count or 0),
            parent_log_id=parent_log_id,
            fallback_attempted=False,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return str(row.id)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa_log] log_attempt failed: {e}")
        return None
    finally:
        db.close()


def update_from_send_result(log_id: str | None, result: dict | None) -> None:
    """Persist the immediate Meta response (success or failure) into the
    attempt row. Also sets ``whatsapp_available`` tri-state when we have
    enough signal to decide."""
    if not log_id or not isinstance(result, dict):
        return
    try:
        from core.database import SessionLocal
        from models.wa_message_log import WAMessageLog
    except Exception:
        return
    db = SessionLocal()
    try:
        row = db.query(WAMessageLog).filter(WAMessageLog.id == log_id).first()
        if not row:
            return
        row.response_payload = _safe_jsonable(result)
        ok = bool(result.get("ok"))
        message_id = result.get("message_id")
        not_on_wa = bool(result.get("not_on_whatsapp"))
        now = datetime.utcnow()
        row.last_status_at = now
        if ok and message_id:
            row.provider_message_id = str(message_id)
            row.status = "sent"
            row.sent_at = now
            row.whatsapp_available = True
        else:
            row.status = "rejected" if not_on_wa else "failed"
            row.failed_at = now
            row.error_code = (str(result.get("error_code"))
                              if result.get("error_code") is not None else None)
            err = result.get("error")
            if isinstance(err, (dict, list)):
                err = json.dumps(err, default=str)[:2000]
            row.error_message = (str(err)[:2000] if err else None)
            # Extract richer error detail from the edge function payload when present.
            err_title = result.get("error_title")
            if err_title:
                row.error_title = str(err_title)[:255]
            err_details = result.get("error_details")
            if err_details is not None:
                row.error_details = _safe_jsonable(err_details)
            fbt = result.get("fbtrace_id")
            if fbt:
                row.fbtrace_id = str(fbt)[:128]
            row.failure_reason = _humanize(row.error_code, row.error_message,
                                           not_on_whatsapp=not_on_wa)
            if not_on_wa or (row.error_code and str(row.error_code) in _NOT_ON_WA_CODES):
                row.whatsapp_available = False
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa_log] update_from_send_result failed: {e}")
    finally:
        db.close()


def update_from_status(provider_message_id: str, status: str, *,
                       error_code: str | None = None,
                       error_message: str | None = None,
                       error_title: str | None = None,
                       error_details: Any = None,
                       fbtrace_id: str | None = None,
                       webhook_payload: Any = None) -> None:
    """Called from the Meta webhook receiver. Advances delivery status
    monotonically (queued < sent < delivered < read) and captures any
    failure detail Meta included."""
    if not provider_message_id or not status:
        return
    try:
        from core.database import SessionLocal
        from models.wa_message_log import WAMessageLog
    except Exception:
        return
    db = SessionLocal()
    try:
        row = (db.query(WAMessageLog)
                 .filter(WAMessageLog.provider_message_id == str(provider_message_id))
                 .order_by(WAMessageLog.created_at.desc())
                 .first())
        if not row:
            return
        st = str(status).lower()
        order = {"queued": 0, "sent": 1, "delivered": 2, "read": 3}
        now = datetime.utcnow()
        row.last_status_at = now
        if st == "failed":
            row.status = "failed"
            row.failed_at = now
            if error_code:
                row.error_code = str(error_code)[:64]
            if error_message:
                row.error_message = str(error_message)[:2000]
            if error_title:
                row.error_title = str(error_title)[:255]
            if error_details is not None:
                row.error_details = _safe_jsonable(error_details)
            if fbtrace_id:
                row.fbtrace_id = str(fbtrace_id)[:128]
            row.failure_reason = _humanize(row.error_code, row.error_message)
            if row.error_code and str(row.error_code) in _NOT_ON_WA_CODES:
                row.whatsapp_available = False
        else:
            cur = order.get(row.status, 0)
            nxt = order.get(st, 0)
            if nxt >= cur:
                row.status = st
            if st == "sent" and not row.sent_at:
                row.sent_at = now
            if st == "delivered":
                if not row.delivered_at:
                    row.delivered_at = now
                if not row.sent_at:
                    row.sent_at = now
                row.whatsapp_available = True
            if st == "read":
                if not row.read_at:
                    row.read_at = now
                if not row.delivered_at:
                    row.delivered_at = now
                if not row.sent_at:
                    row.sent_at = now
                row.whatsapp_available = True
        if webhook_payload is not None:
            row.webhook_payload = _safe_jsonable(webhook_payload)
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa_log] update_from_status failed: {e}")
    finally:
        db.close()


def record_fallback(log_id: str | None, *,
                    channel: str = "sms",
                    status: str = "queued",
                    provider: str | None = None,
                    message_id: str | None = None,
                    error: str | None = None) -> None:
    """Record SMS-fallback attempt against the original WA log row.

    Call this whenever Nuru decides to send an SMS because the WhatsApp
    delivery failed (recipient not on WhatsApp, etc).
    """
    if not log_id:
        return
    try:
        from core.database import SessionLocal
        from models.wa_message_log import WAMessageLog
    except Exception:
        return
    db = SessionLocal()
    try:
        row = db.query(WAMessageLog).filter(WAMessageLog.id == log_id).first()
        if not row:
            return
        row.fallback_channel = str(channel)[:32]
        row.fallback_attempted = True
        row.fallback_status = str(status)[:32]
        if provider:
            row.fallback_provider = str(provider)[:64]
        if message_id:
            row.fallback_message_id = str(message_id)[:255]
        if error:
            row.fallback_error = str(error)[:2000]
        if status in ("sent", "delivered"):
            row.fallback_sent_at = datetime.utcnow()
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa_log] record_fallback failed: {e}")
    finally:
        db.close()
