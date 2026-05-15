# WhatsApp invitation card / ticket delivery helpers.
#
# Two-step pipeline (mirrors the frontend EventGuestList / EventTicketManagement
# buttons so backend auto-triggers and manual sends produce identical messages):
#   1. POST /functions/v1/render-card        → returns { url } of a PNG
#   2. POST /functions/v1/whatsapp-send      → sends Meta media template
#
# All calls are fire-and-forget (run in a background thread) and never raise.

import os
import threading
import requests

from utils.whatsapp import _normalize_phone

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
RENDER_URL = f"{SUPABASE_URL}/functions/v1/render-card" if SUPABASE_URL else ""
SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""

_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "apikey": SUPABASE_ANON_KEY,
}


def _render(payload: dict) -> str | None:
    if not RENDER_URL or not SUPABASE_ANON_KEY:
        return None
    try:
        r = requests.post(RENDER_URL, json=payload, headers=_HEADERS, timeout=30)
        if not r.ok:
            print(f"[wa_cards] render failed ({r.status_code}): {r.text[:200]}")
            return None
        return (r.json() or {}).get("url")
    except Exception as e:
        print(f"[wa_cards] render exception: {e}")
        return None


def _send(action: str, phone: str, params: dict) -> bool:
    if not SEND_URL or not SUPABASE_ANON_KEY:
        return False
    try:
        r = requests.post(
            SEND_URL,
            json={"action": action, "phone": phone, "params": params},
            headers=_HEADERS,
            timeout=15,
        )
        if not r.ok:
            print(f"[wa_cards] send failed ({r.status_code}): {r.text[:200]}")
            return False
        return True
    except Exception as e:
        print(f"[wa_cards] send exception: {e}")
        return False


# ── Public helpers ────────────────────────────────────────────────────────────

def wa_send_invitation_card(
    phone: str,
    event_id: str,
    guest_id: str,
    guest_name: str,
    event_name: str,
    event_date: str = "TBD",
    organizer_name: str = "Your host",
    rsvp_code: str = "",
):
    """Render + send the invitation card. Fire-and-forget."""
    intl = _normalize_phone(phone)
    if not intl:
        return

    def _run():
        url = _render({
            "kind": "invitation",
            "event_id": str(event_id),
            "guest_id": str(guest_id),
            "guest_name": guest_name or "Guest",
            "qr_value": str(guest_id),
        })
        if not url:
            return
        _send("send_invitation_card", intl, {
            "image_url": url,
            "guest_name": guest_name or "Guest",
            "event_name": event_name or "the event",
            "event_date": event_date or "TBD",
            "organizer_name": organizer_name or "Your host",
            "rsvp_code": (rsvp_code or str(guest_id))[:8] or "—",
        })

    threading.Thread(target=_run, daemon=True).start()


def wa_send_ticket(
    phone: str,
    event_id: str,
    ticket_code: str,
    buyer_name: str,
    event_name: str,
    event_date: str = "TBD",
    ticket_class: str = "General",
):
    """Render + send the ticket card. Fire-and-forget."""
    intl = _normalize_phone(phone)
    if not intl:
        return

    def _run():
        url = _render({
            "kind": "ticket",
            "event_id": str(event_id),
            "ticket_code": ticket_code,
        })
        if not url:
            return
        _send("send_ticket", intl, {
            "image_url": url,
            "guest_name": buyer_name or "Friend",
            "event_name": event_name or "the event",
            "event_date": event_date or "TBD",
            "ticket_class": ticket_class or "General",
            "ticket_code": ticket_code,
        })

    threading.Thread(target=_run, daemon=True).start()
