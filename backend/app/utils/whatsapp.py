# WhatsApp notification helpers
# Sends outbound WhatsApp messages via the Supabase edge function (whatsapp-send)
# WhatsApp is the PRIMARY channel for all event communications.
# Copy aligned with Nuru Copywriting Master Document.

import os
import requests

WHATSAPP_SIGNATURE = "\n— Nuru: Keep your event together"

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
    """Send a plain text WhatsApp message. Used for contribution/pledge notifications."""
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
# WhatsApp is the primary channel; SMS is the fallback.
# ──────────────────────────────────────────────

def wa_contribution_recorded(phone: str, contributor_name: str, event_title: str, amount: float, target: float, total_paid: float, currency: str = "TZS", organizer_phone: str = None, recorder_name: str = None):
    """Notify contributor via WhatsApp that their payment has been recorded."""
    balance = max(0, target - total_paid)
    if recorder_name:
        msg = (
            f"Hello {contributor_name}, {recorder_name} has recorded your contribution of {currency} {amount:,.0f} "
            f"for {event_title}.\n"
        )
    else:
        msg = (
            f"Hello {contributor_name}, your contribution of {currency} {amount:,.0f} "
            f"for {event_title} has been recorded.\n"
        )
    if target > 0:
        msg += f"Target: {currency} {target:,.0f} | Paid: {currency} {total_paid:,.0f} | Balance: {currency} {balance:,.0f}"
    else:
        msg += f"Total paid: {currency} {total_paid:,.0f}"
    if organizer_phone:
        msg += f"\nFor inquiries, contact the organizer at {organizer_phone}."
    msg += WHATSAPP_SIGNATURE
    _send_whatsapp_text(phone, msg)


def wa_contribution_target_set(phone: str, contributor_name: str, event_title: str, target: float, total_paid: float = 0, currency: str = "TZS", organizer_phone: str = None):
    """Notify contributor via WhatsApp when a pledge target is set or updated."""
    balance = max(0, target - total_paid)
    msg = (
        f"Hello {contributor_name}, your expected contribution for {event_title} "
        f"is {currency} {target:,.0f}.\n"
    )
    if total_paid > 0:
        msg += f"Paid so far: {currency} {total_paid:,.0f} | Still pending: {currency} {balance:,.0f}"
    else:
        msg += f"Your contribution is still pending."
    if organizer_phone:
        msg += f"\nFor inquiries, contact the organizer at {organizer_phone}."
    msg += WHATSAPP_SIGNATURE
    _send_whatsapp_text(phone, msg)


def wa_thank_you(phone: str, contributor_name: str, event_title: str, custom_message: str = "", organizer_phone: str = None):
    """Send thank you message via WhatsApp to a contributor."""
    msg = f"Hello {contributor_name}, thank you for your contribution to {event_title}."
    if custom_message:
        msg += f" {custom_message}"
    if organizer_phone:
        msg += f"\nFor inquiries, contact the organizer at {organizer_phone}."
    msg += WHATSAPP_SIGNATURE
    _send_whatsapp_text(phone, msg)


def wa_booking_notification(phone: str, provider_name: str, event_title: str, client_name: str):
    """Notify service provider via WhatsApp they've been booked for an event."""
    msg = (
        f"Hello {provider_name}, {client_name} has booked your service for {event_title}. "
        f"Open Nuru to see the details."
    )
    msg += WHATSAPP_SIGNATURE
    _send_whatsapp_text(phone, msg)


def wa_booking_accepted(phone: str, client_name: str, vendor_name: str, service_name: str, event_title: str):
    """Notify event organizer via WhatsApp that their vendor booking was accepted."""
    msg = (
        f"Hello {client_name}, {vendor_name} has confirmed your booking for {service_name} "
        f"at {event_title}. Open Nuru to see the details."
    )
    msg += WHATSAPP_SIGNATURE
    _send_whatsapp_text(phone, msg)
