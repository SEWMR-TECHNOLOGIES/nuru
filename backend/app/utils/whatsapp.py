# WhatsApp notification helpers
# Sends outbound WhatsApp messages via the Supabase edge function (whatsapp-send)

import os
import requests

WHATSAPP_SIGNATURE = "\n— Nuru: Plan Smarter"

# The edge function URL for sending WhatsApp messages
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""


def _normalize_phone(phone: str) -> str:
    """Convert local Tanzanian phone to international format for WhatsApp."""
    if not phone:
        return ""
    phone = phone.strip().replace(" ", "")
    if phone.startswith("+"):
        return phone.lstrip("+")
    if phone.startswith("0"):
        return "255" + phone[1:]
    if phone.startswith("255"):
        return phone
    return phone


def _send_whatsapp(action: str, phone: str, params: dict):
    """Fire-and-forget WhatsApp message via edge function. Logs errors but never raises."""
    if not phone or not WHATSAPP_SEND_URL or not SUPABASE_ANON_KEY:
        return

    international_phone = _normalize_phone(phone)
    if not international_phone:
        return

    try:
        resp = requests.post(
            WHATSAPP_SEND_URL,
            json={"action": action, "phone": international_phone, "params": params},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=15,
        )
        if not resp.ok:
            print(f"[WhatsApp] Failed ({resp.status_code}): {resp.text[:200]}")
    except Exception as e:
        print(f"[WhatsApp] Error sending to {international_phone}: {e}")


def wa_guest_invited(phone: str, guest_name: str, event_name: str, event_date: str = "", organizer_name: str = "", rsvp_code: str = ""):
    """Send WhatsApp invitation when a guest is added to an event."""
    _send_whatsapp("invite", phone, {
        "guest_name": guest_name,
        "event_name": event_name,
        "event_date": event_date,
        "organizer_name": organizer_name,
        "rsvp_code": rsvp_code,
    })


def wa_event_updated(phone: str, guest_name: str, event_name: str, changes: str):
    """Notify guest about event detail changes via WhatsApp."""
    _send_whatsapp("event_update", phone, {
        "guest_name": guest_name,
        "event_name": event_name,
        "changes": changes,
    })


def wa_event_reminder(phone: str, guest_name: str, event_name: str, event_date: str = "", event_time: str = "", location: str = ""):
    """Send event reminder via WhatsApp."""
    _send_whatsapp("reminder", phone, {
        "guest_name": guest_name,
        "event_name": event_name,
        "event_date": event_date,
        "event_time": event_time,
        "location": location,
    })
