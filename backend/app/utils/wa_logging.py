"""
WhatsApp message log helpers
============================
One central place to write to the ``wa_message_logs`` table from the
WhatsApp send pipeline (and from the Meta webhook). Deliberately
defensive: every helper opens/closes its own DB session and swallows
errors so logging can never break the actual send.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

# Categorise an outgoing action into a high-level message purpose so the
# WhatsApp Logs UI can group "invitation" / "otp" / etc without having to
# know every template name.
_CATEGORY_MAP = {
    # invitations / RSVPs
    "guest_invitation": "invitation",
    "send_invitation_text": "invitation",
    "send_invitation_card": "invitation_card",
    "invitation_card_message": "invitation_card",

    # OTP / auth
    "otp": "otp",
    "otp_login": "otp",
    "otp_signup": "otp",
    "password_reset": "password_reset",
    "welcome_registered_by": "account_setup",

    # contributions
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

    # committee
    "committee_invite": "committee",

    # meetings
    "meeting_invitation": "meeting",

    # tickets
    "ticket_purchased": "ticket",
    "ticket_transferred": "ticket",

    # payments
    "payment_received_generic": "payment",
    "payment_confirmation_payer": "payment",
    "admin_payment_alert": "payment",
    "vendor_booking_paid": "vendor_booking",
    "vendor_confirmation_receipt": "vendor_booking",
    "vendor_confirmation_receipt_full": "vendor_booking",
    "organiser_committee_vendor_confirmed": "vendor_booking",

    # bookings
    "service_booking_notification": "vendor_booking",
    "booking_accepted": "vendor_booking",

    # misc
    "expense_recorded": "expense",
    "reminder": "reminder",
    "text": "text",
}

# Friendly explanations for the most common Meta error codes — surfaced
# to users in the Logs UI so they aren't reading raw numbers.
_HUMAN_ERRORS = {
    "131026": "Recipient is not on WhatsApp.",
    "131047": "More than 24 hours since the user's last message — a template is required.",
    "131051": "Unsupported message type.",
    "131056": "Pair rate limit reached for this phone number.",
    "132000": "Template parameter count mismatch.",
    "132001": "Template does not exist in the chosen language.",
    "132005": "Translated text too long for the template.",
    "132007": "Template is paused due to low quality.",
    "132012": "Template parameter format is invalid.",
    "132015": "Template is paused.",
    "132016": "Template is disabled.",
    "133010": "Phone number is not registered with WhatsApp Business.",
    "470": "Message failed to send because more than 24 hours have passed since the customer last replied.",
}


def _category_for(action: str) -> str:
    if not action:
        return "system"
    a = action.lower()
    if a in _CATEGORY_MAP:
        return _CATEGORY_MAP[a]
    if "otp" in a:
        return "otp"
    if "ticket" in a:
        return "ticket"
    if "invitation" in a:
        return "invitation"
    if "contribution" in a or "pledge" in a:
        return "contribution"
    if "vendor" in a or "booking" in a:
        return "vendor_booking"
    if "committee" in a:
        return "committee"
    if "meeting" in a:
        return "meeting"
    if "payment" in a:
        return "payment"
    if "reminder" in a:
        return "reminder"
    return "template"


def _message_type_for(action: str, params: dict) -> str:
    if action == "text":
        return "text"
    has_image = bool((params or {}).get("image_url") or (params or {}).get("media_url"))
    if has_image:
        return "media"
    return "template"


def _safe_jsonable(value: Any) -> Any:
    """Best-effort coercion to a JSONB-storable structure."""
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
) -> str | None:
    """Insert a queued attempt row. Returns the new log id (str), or None."""
    try:
        from core.database import SessionLocal
        from models.wa_message_log import WAMessageLog
    except Exception as e:  # noqa: BLE001
        print(f"[wa_log] import failed: {e}")
        return None

    params = params or {}
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

        row = WAMessageLog(
            recipient_phone=str(phone)[:32],
            normalized_phone=_normalize_phone(phone)[:32] or None,
            category=category,
            action=action,
            template_name=action if msg_type == "template" or msg_type == "media" else None,
            message_type=msg_type,
            language=str(params.get("lang") or "")[:8] or None,
            request_payload=_safe_jsonable({"action": action, "params": params}),
            summary=(summary or "")[:1000] or None,
            media_url=str(media_url) if media_url else None,
            media_type="image" if media_url else None,
            status="queued",
            retry_count=int(retry_count or 0),
            parent_log_id=parent_log_id,
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
        if ok and message_id:
            row.provider_message_id = str(message_id)
            row.status = "sent"
            row.sent_at = datetime.utcnow()
        else:
            row.status = "rejected" if not_on_wa else "failed"
            row.failed_at = datetime.utcnow()
            row.error_code = (str(result.get("error_code"))
                              if result.get("error_code") is not None else None)
            err = result.get("error")
            if isinstance(err, (dict, list)):
                err = json.dumps(err, default=str)[:2000]
            row.error_message = (str(err)[:2000] if err else None)
            row.failure_reason = _humanize(row.error_code, row.error_message,
                                           not_on_whatsapp=not_on_wa)
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa_log] update_from_send_result failed: {e}")
    finally:
        db.close()


def update_from_status(provider_message_id: str, status: str, *,
                       error_code: str | None = None,
                       error_message: str | None = None,
                       webhook_payload: Any = None) -> None:
    """Called from the Meta webhook receiver."""
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
        if st == "failed":
            row.status = "failed"
            row.failed_at = now
            if error_code:
                row.error_code = str(error_code)[:64]
            if error_message:
                row.error_message = str(error_message)[:2000]
            row.failure_reason = _humanize(row.error_code, row.error_message)
        else:
            cur = order.get(row.status, 0)
            nxt = order.get(st, 0)
            if nxt >= cur:
                row.status = st
            if st == "sent" and not row.sent_at:
                row.sent_at = now
            if st == "delivered" and not row.delivered_at:
                row.delivered_at = now
            if st == "read" and not row.read_at:
                row.read_at = now
        if webhook_payload is not None:
            row.webhook_payload = _safe_jsonable(webhook_payload)
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa_log] update_from_status failed: {e}")
    finally:
        db.close()
