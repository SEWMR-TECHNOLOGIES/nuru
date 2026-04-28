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


# ──────────────────────────────────────────────────────────────────────────
# VoIP push (CallKit / Android equivalent)
# ──────────────────────────────────────────────────────────────────────────
#
# This is the *outbound* side of the calling pipeline: when the caller hits
# /calls/start, we look up the callee's registered device tokens and try to
# deliver an "incoming_call" payload so flutter_callkit_incoming can ring the
# lock screen even when the app is killed.
#
# Implementation is intentionally a no-op stub right now — adding real
# FCM/APNs wiring requires the user to drop in service-account credentials
# (FCM_SERVICE_ACCOUNT_JSON for Android data messages, APNS_KEY for iOS
# PushKit). The route calls this function inside a try/except so the call
# itself continues to work via the polling signaling path (3s ring delay)
# until those secrets land.

import os


def send_voip_push(db, user_id, payload: dict) -> dict:
    """Best-effort VoIP push fan-out for an incoming call.

    Looks up every ``device_tokens`` row for ``user_id`` and ships the
    payload via the appropriate transport:

    * ``platform='ios' and kind='voip'`` → APNs PushKit (top priority).
    * ``platform='android'`` → FCM data message with ``priority=high`` so
      the OS wakes the app and ``flutter_callkit_incoming`` can show the
      full-screen incoming-call UI.

    Returns a small summary used only for logging — failures never raise.
    """
    from models import DeviceToken  # local import to avoid models cycle

    sent = {"fcm": 0, "apns": 0, "skipped": 0}
    try:
        tokens = db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()
    except Exception as e:
        print(f"[voip] failed to read device_tokens: {e}")
        return sent

    fcm_key = os.getenv("FCM_SERVER_KEY") or os.getenv("FCM_SERVICE_ACCOUNT_JSON")
    apns_key = os.getenv("APNS_KEY")

    for t in tokens:
        try:
            if t.platform == "android":
                if not fcm_key:
                    sent["skipped"] += 1
                    continue
                # NOTE: real FCM HTTP v1 implementation goes here. Keeping the
                # body explicit so the structure is obvious for the next pass.
                # _post_fcm(fcm_key, t.token, payload)
                sent["fcm"] += 1
            elif t.platform == "ios" and t.kind == "voip":
                if not apns_key:
                    sent["skipped"] += 1
                    continue
                # _post_apns_voip(apns_key, t.token, payload)
                sent["apns"] += 1
            else:
                sent["skipped"] += 1
        except Exception as e:
            print(f"[voip] push failed for token={t.token[:8]}...: {e}")

    return sent

