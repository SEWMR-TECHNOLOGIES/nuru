# WhatsApp notification helpers
# Sends outbound WhatsApp messages via the Supabase edge function (whatsapp-send)
# WhatsApp is the PRIMARY channel for all event communications.
# ALL messages now use Meta-approved templates via the edge function.

import os
import requests

WHATSAPP_SIGNATURE = "\n-- Nuru: Keep your event together"

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


def _send_whatsapp_text(phone: str, message: str):
    """Send a plain text WhatsApp message. Only used as fallback within 24h window."""
    _send_whatsapp("text", phone, {"message": message})


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


def wa_expense_recorded(phone: str, recipient_name: str, recorder_name: str, amount: str, category: str, event_name: str):
    """Notify committee member about a recorded expense via WhatsApp."""
    _send_whatsapp("expense_recorded", phone, {
        "recipient_name": recipient_name,
        "recorder_name": recorder_name,
        "amount": amount,
        "category": category,
        "event_name": event_name,
    })


# ──────────────────────────────────────────────
# CONTRIBUTION / PLEDGE WhatsApp Messages
# Now using Meta-approved templates instead of plain text
# ──────────────────────────────────────────────

def wa_contribution_recorded(phone: str, contributor_name: str, event_title: str, amount: float, target: float, total_paid: float, currency: str = "TZS", organizer_phone: str = None, recorder_name: str = None):
    """Notify contributor via WhatsApp that their payment has been recorded (template)."""
    balance = max(0, target - total_paid)
    _send_whatsapp("contribution_recorded", phone, {
        "contributor_name": contributor_name,
        "recorder_name": recorder_name or "The organizer",
        "amount": f"{currency} {amount:,.0f}",
        "event_name": event_title,
        "target": f"{currency} {target:,.0f}" if target > 0 else "N/A",
        "total_paid": f"{currency} {total_paid:,.0f}",
        "balance": f"{currency} {balance:,.0f}" if target > 0 else "N/A",
    })


def wa_contribution_target_set(phone: str, contributor_name: str, event_title: str, target: float, total_paid: float = 0, currency: str = "TZS", organizer_phone: str = None):
    """Notify contributor via WhatsApp when a pledge target is set or updated (template)."""
    balance = max(0, target - total_paid)
    _send_whatsapp("contribution_target", phone, {
        "contributor_name": contributor_name,
        "event_name": event_title,
        "target": f"{currency} {target:,.0f}",
        "total_paid": f"{currency} {total_paid:,.0f}",
        "balance": f"{currency} {balance:,.0f}",
    })


def wa_thank_you(phone: str, contributor_name: str, event_title: str, custom_message: str = "", organizer_phone: str = None):
    """Send thank you message via WhatsApp to a contributor (template)."""
    _send_whatsapp("thank_you_contribution", phone, {
        "contributor_name": contributor_name,
        "event_name": event_title,
        "custom_message": custom_message or "We appreciate your support!",
    })


def wa_booking_notification(phone: str, provider_name: str, event_title: str, client_name: str):
    """Notify service provider via WhatsApp they've been booked for an event (template)."""
    _send_whatsapp("booking_notification", phone, {
        "provider_name": provider_name,
        "client_name": client_name,
        "event_name": event_title,
    })


def wa_booking_accepted(phone: str, client_name: str, vendor_name: str, service_name: str, event_title: str):
    """Notify event organizer via WhatsApp that their vendor booking was accepted (template)."""
    _send_whatsapp("booking_accepted", phone, {
        "client_name": client_name,
        "vendor_name": vendor_name,
        "service_name": service_name,
        "event_name": event_title,
    })


def wa_meeting_invitation(phone: str, event_name: str, meeting_title: str, scheduled_time: str, meeting_link: str):
    """Invite participant to an event meeting via WhatsApp."""
    _send_whatsapp("meeting_invitation", phone, {
        "event_name": event_name,
        "meeting_title": meeting_title,
        "scheduled_time": scheduled_time,
        "meeting_link": meeting_link,
    })
