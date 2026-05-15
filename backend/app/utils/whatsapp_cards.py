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

SUPABASE_URL = (os.getenv("EDGE_FUNCTION_URL", "") or os.getenv("SUPABASE_URL", "") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "") or os.getenv("SUPABASE_PUBLISHABLE_KEY", "") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", "")
CURRENT_FUNCTIONS_URL = "https://lmfprculxhspqxppscbn.supabase.co"
RENDER_URL = f"{SUPABASE_URL}/functions/v1/render-card" if SUPABASE_URL else ""
SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""

_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "apikey": SUPABASE_ANON_KEY,
}


def _render(payload: dict) -> str | None:
    urls = [RENDER_URL] if RENDER_URL else []
    fallback_url = f"{CURRENT_FUNCTIONS_URL}/functions/v1/render-card"
    if fallback_url not in urls:
        urls.append(fallback_url)
    if not urls:
        print("[wa_cards] render skipped: missing edge function URL")
        return None
    print(f"[wa_cards] render payload: {payload}")
    for url in urls:
        try:
            print(f"[wa_cards] render url={url}")
            r = requests.post(url, json=payload, headers=_HEADERS, timeout=30)
            if not r.ok:
                print(f"[wa_cards] render failed ({r.status_code}): {r.text[:200]}")
                continue
            data = r.json() or {}
            print(f"[wa_cards] render response: {data}")
            return data.get("url")
        except Exception as e:
            print(f"[wa_cards] render exception url={url}: {e}")
    return None


def _send(action: str, phone: str, params: dict) -> bool:
    urls = [SEND_URL] if SEND_URL else []
    fallback_url = f"{CURRENT_FUNCTIONS_URL}/functions/v1/whatsapp-send"
    if fallback_url not in urls:
        urls.append(fallback_url)
    if not urls:
        print("[wa_cards] send skipped: missing edge function URL")
        return False
    print(f"[wa_cards] send action={action} phone={phone} params={params}")
    for url in urls:
        try:
            print(f"[wa_cards] send url={url}")
            r = requests.post(
                url,
                json={"action": action, "phone": phone, "params": params},
                headers=_HEADERS,
                timeout=15,
            )
            if not r.ok:
                print(f"[wa_cards] send failed ({r.status_code}): {r.text[:200]}")
                continue
            print(f"[wa_cards] send response: {r.text[:300]}")
            return True
        except Exception as e:
            print(f"[wa_cards] send exception url={url}: {e}")
    return False


# ── Public helpers ────────────────────────────────────────────────────────────

def wa_send_invitation_card(
    phone: str,
    event_id: str,
    guest_id: str,
    guest_name: str,
    event_name: str,
    event_date: str = "",
    organizer_name: str = "",
    rsvp_code: str = "",
    cover_image: str = "",
    event_time: str = "",
    venue: str = "",
    address: str = "",
):
    """Render + send the invitation card. Fire-and-forget."""
    intl = _normalize_phone(phone)
    if not intl:
        return

    safe_event = (event_name or "").strip() or "the event"
    safe_date = (event_date or "").strip() or "TBA"
    safe_host = (organizer_name or "").strip() or "the organizer"
    safe_name = (guest_name or "").strip() or "Guest"

    def _run():
        invite_code = (rsvp_code or str(guest_id) or "").strip().upper()
        print(
            "[wa_cards] invitation input "
            f"event_id={event_id} guest_id={guest_id} guest_name={safe_name!r} "
            f"event_name={safe_event!r} date={event_date!r} time={event_time!r} "
            f"venue={venue!r} address={address!r} organizer={safe_host!r} "
            f"cover_image={cover_image!r} code={invite_code!r}"
        )
        url = _render({
            "kind": "invitation",
            "event_id": str(event_id),
            "guest_id": str(guest_id),
            "guest_name": safe_name,
            "event_name": safe_event,
            "date": event_date or "",
            "time": event_time or "",
            "venue": venue or "",
            "address": address or "",
            "host_line": safe_host,
            "invitation_code": invite_code,
            "qr_value": invite_code or str(guest_id),
            "cover_image": cover_image or "",
        })
        if not url:
            # Card render failed — fall back to the approved text template
            # so the guest still receives a usable WhatsApp invitation.
            _send("send_invitation_text", intl, {
                "guest_name": safe_name,
                "event_name": safe_event,
                "organizer_name": safe_host,
                "event_date": safe_date,
                "event_time": (event_time or "").strip() or "TBA",
                "venue": (venue or "").strip() or "TBA",
                "rsvp_code": invite_code or "—",
            })
            return
        _send("send_invitation_card", intl, {
            "image_url": url,
            "guest_name": safe_name,
            "event_name": safe_event,
            "event_date": safe_date,
            "organizer_name": safe_host,
            "rsvp_code": invite_code or "—",
        })

    threading.Thread(target=_run, daemon=True).start()


def wa_send_invitation_text(
    phone: str,
    guest_name: str,
    event_name: str,
    organizer_name: str = "",
    event_date: str = "",
    event_time: str = "",
    venue: str = "",
    rsvp_code: str = "",
):
    """Send the plain-text WhatsApp invitation (no image). Fire-and-forget."""
    intl = _normalize_phone(phone)
    if not intl:
        return

    def _run():
        _send("send_invitation_text", intl, {
            "guest_name": (guest_name or "").strip() or "Guest",
            "event_name": (event_name or "").strip() or "the event",
            "organizer_name": (organizer_name or "").strip() or "the organizer",
            "event_date": (event_date or "").strip() or "TBA",
            "event_time": (event_time or "").strip() or "TBA",
            "venue": (venue or "").strip() or "TBA",
            "rsvp_code": (rsvp_code or "").strip() or "—",
        })

    threading.Thread(target=_run, daemon=True).start()


def wa_send_ticket(
    phone: str,
    event_id: str,
    ticket_code: str,
    buyer_name: str,
    event_name: str,
    event_date: str = "",
    ticket_class: str = "General",
    cover_image: str = "",
    event_time: str = "",
    venue: str = "",
    address: str = "",
):
    """Render + send the ticket card. Fire-and-forget."""
    intl = _normalize_phone(phone)
    if not intl:
        return

    safe_event = (event_name or "").strip() or "the event"
    safe_date = (event_date or "").strip() or "TBA"
    safe_name = (buyer_name or "").strip() or "Friend"
    safe_class = (ticket_class or "").strip() or "General"

    def _run():
        url = _render({
            "kind": "ticket",
            "event_id": str(event_id),
            "ticket_code": ticket_code,
            "ticket_data": {
                "event_name": safe_event,
                "cover_image": cover_image or "",
                "event": {
                    "name": safe_event,
                    "start_date": event_date or "",
                    "start_time": event_time or "",
                    "location": venue or "",
                    "cover_image": cover_image or "",
                },
                "ticket_class_name": safe_class,
                "event_location": venue or "",
                "status": "confirmed",
            },
        })
        if not url:
            return
        _send("send_ticket", intl, {
            "image_url": url,
            "guest_name": safe_name,
            "event_name": safe_event,
            "event_date": safe_date,
            "ticket_class": safe_class,
            "ticket_code": ticket_code,
        })

    threading.Thread(target=_run, daemon=True).start()
