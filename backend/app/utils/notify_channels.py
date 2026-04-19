# Unified WhatsApp-first → SMS-fallback notifier for free-form messages.
# Use this for ad-hoc transactional messages where no Meta-approved template
# applies (e.g. contribution approval/rejection acknowledgements).
#
# Templated invitations / reminders should keep using utils/whatsapp.py
# functions directly + utils/sms.py fallbacks per the existing pattern.

from utils.whatsapp import _send_whatsapp_text
from utils.sms import _send as _send_sms_raw


def _is_tz_number(phone: str) -> bool:
    """Return True if the phone is a Tanzanian number (+255 / 0 / 255 prefix)."""
    if not phone:
        return False
    p = phone.strip().replace(" ", "").lstrip("+")
    if p.startswith("255"):
        return True
    if p.startswith("0") and len(p) >= 10:
        return True
    return False


def notify_user_wa_sms(phone: str, message: str) -> dict:
    """
    Send a free-form notification via WhatsApp first, falling back to SMS for
    Tanzanian numbers if WhatsApp delivery fails.

    Returns: { "channel": "whatsapp" | "sms" | "none", "ok": bool }
    """
    if not phone or not message:
        return {"channel": "none", "ok": False}

    # 1. Try WhatsApp text (only delivers within a 24h conversation window,
    #    but `_send_whatsapp_text` is fire-and-forget and returns nothing,
    #    so we treat it as best-effort and *always* fall back to SMS for TZ
    #    numbers — SMS is the channel users said is mandatory in TZ.)
    try:
        _send_whatsapp_text(phone, message)
    except Exception as e:
        print(f"[notify] WA send error for {phone}: {e}")

    # 2. SMS fallback for TZ numbers (covers users not reachable on WhatsApp).
    if _is_tz_number(phone):
        try:
            _send_sms_raw(phone, message)
            return {"channel": "sms", "ok": True}
        except Exception as e:
            print(f"[notify] SMS fallback failed for {phone}: {e}")
            return {"channel": "sms", "ok": False}

    return {"channel": "whatsapp", "ok": True}
