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


def upload_card_png(path: str, png_bytes: bytes) -> str | None:
    """Upload pre-rendered PNG bytes to Supabase Storage via the render-card
    edge function and return the public URL. Used to give Meta a stable,
    publicly reachable image URL for template header media."""
    import base64
    urls = [RENDER_URL] if RENDER_URL else []
    fallback_url = f"{CURRENT_FUNCTIONS_URL}/functions/v1/render-card"
    if fallback_url not in urls:
        urls.append(fallback_url)
    if not urls or not png_bytes:
        return None
    payload = {
        "kind": "upload",
        "path": path,
        "png_b64": base64.b64encode(png_bytes).decode("ascii"),
    }
    for url in urls:
        try:
            r = requests.post(url, json=payload, headers=_HEADERS, timeout=30)
            if not r.ok:
                print(f"[wa_cards] upload failed ({r.status_code}): {r.text[:200]}")
                continue
            data = r.json() or {}
            print(f"[wa_cards] upload ok path={path} url={data.get('url')}")
            return data.get("url")
        except Exception as e:
            print(f"[wa_cards] upload exception url={url}: {e}")
    return None


def upload_card_svg(path: str, svg: str) -> str | None:
    """Rasterize SVG in the render-card edge function, upload the resulting
    PNG to public storage, and return the public URL. This avoids relying on
    CairoSVG/system libraries inside the API server."""
    import base64
    urls = [RENDER_URL] if RENDER_URL else []
    fallback_url = f"{CURRENT_FUNCTIONS_URL}/functions/v1/render-card"
    if fallback_url not in urls:
        urls.append(fallback_url)
    if not urls or not svg:
        return None
    payload = {
        "kind": "upload",
        "path": path,
        "svg_b64": base64.b64encode(svg.encode("utf-8")).decode("ascii"),
    }
    for url in urls:
        try:
            r = requests.post(url, json=payload, headers=_HEADERS, timeout=45)
            if not r.ok:
                print(f"[wa_cards] svg upload failed ({r.status_code}): {r.text[:200]}")
                continue
            data = r.json() or {}
            print(f"[wa_cards] svg upload ok path={path} url={data.get('url')}")
            return data.get("url")
        except Exception as e:
            print(f"[wa_cards] svg upload exception url={url}: {e}")
    return None


def upload_card_svg_url(path: str, svg_url: str) -> str | None:
    """Ask render-card to fetch a public SVG URL, rasterize it, upload the
    PNG, and return the public URL. Best for large template SVGs."""
    urls = [RENDER_URL] if RENDER_URL else []
    fallback_url = f"{CURRENT_FUNCTIONS_URL}/functions/v1/render-card"
    if fallback_url not in urls:
        urls.append(fallback_url)
    if not urls or not svg_url:
        return None
    payload = {"kind": "upload", "path": path, "svg_url": svg_url}
    for url in urls:
        try:
            r = requests.post(url, json=payload, headers=_HEADERS, timeout=60)
            if not r.ok:
                print(f"[wa_cards] svg url upload failed ({r.status_code}): {r.text[:200]}")
                continue
            data = r.json() or {}
            print(f"[wa_cards] svg url upload ok path={path} url={data.get('url')}")
            return data.get("url")
        except Exception as e:
            print(f"[wa_cards] svg url upload exception url={url}: {e}")
    return None


def _send(action: str, phone: str, params: dict) -> bool:
    urls = [SEND_URL] if SEND_URL else []
    fallback_url = f"{CURRENT_FUNCTIONS_URL}/functions/v1/whatsapp-send"
    if fallback_url not in urls:
        urls.append(fallback_url)
    if not urls:
        print("[wa_cards] send skipped: missing edge function URL")
        return False
    phone_tail = (phone[-4:] if phone and len(phone) >= 4 else "?")
    print(f"[wa_cards] send action={action} phone_tail={phone_tail} param_keys={sorted(list((params or {}).keys()))}")
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
            # Mirror this template/card send into the admin WhatsApp inbox
            # (wa_conversations + wa_messages) so the admin can see every
            # outbound message — including invitation/ticket/thank-you cards —
            # in the recipient's thread, with delivery status callbacks from
            # the webhook updating the same row.
            try:
                data = r.json() or {}
                wa_message_id = (
                    data.get("message_id")
                    or data.get("wa_message_id")
                    or (((data.get("response") or {}).get("messages") or [{}])[0].get("id"))
                )
                if wa_message_id:
                    from core.database import SessionLocal as _SL
                    from api.routes.whatsapp_admin import _store_incoming as _store
                    _s = _SL()
                    try:
                        from utils.whatsapp import _whatsapp_admin_summary
                        summary = _whatsapp_admin_summary(action, params or {})
                        image_url = (
                            (params or {}).get("image_url")
                            or (params or {}).get("media_url")
                            or (params or {}).get("header_image")
                        )
                        _store(
                            _s,
                            phone=phone,
                            content=str(summary)[:1000],
                            wa_message_id=str(wa_message_id),
                            contact_name=str((params or {}).get("guest_name") or (params or {}).get("name") or ""),
                            direction="outbound",
                            media_url=str(image_url) if image_url else None,
                            media_type="image" if image_url else None,
                        )
                    finally:
                        _s.close()
            except Exception as _e:  # noqa: BLE001
                print(f"[wa_cards] mirror outbound failed: {_e}")
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
    organizer_phone: str = "",
    lang: str = "sw",
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

        render_payload = {
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
        }

        url: str | None = None

        # 1) Prefer an organiser-prepared invitation card (custom design built
        # in the Event Cards manager). If a SentEventCard row already exists
        # for this guest with a rendered image, reuse that exact URL — that's
        # the design the organiser personalised for this specific guest, so
        # it should win over the generic invitation-card render. This covers
        # both "prepared" placeholders and previously-sent cards.
        try:
            from core.database import SessionLocal as _SL
            from models.event_cards import SentEventCard
            from models import EventAttendee
            _s = _SL()
            try:
                att = None
                if guest_id:
                    att = (
                        _s.query(EventAttendee)
                        .filter(
                            EventAttendee.event_id == event_id,
                            EventAttendee.invitation_id == guest_id,
                        )
                        .first()
                    )
                    if not att:
                        att = (
                            _s.query(EventAttendee)
                            .filter(EventAttendee.id == guest_id)
                            .first()
                        )
                if att:
                    sec = (
                        _s.query(SentEventCard)
                        .filter(
                            SentEventCard.event_id == event_id,
                            SentEventCard.guest_attendee_id == att.id,
                            SentEventCard.rendered_card_url.isnot(None),
                        )
                        .order_by(
                            SentEventCard.sent_at.desc().nullslast(),
                            SentEventCard.created_at.desc(),
                        )
                        .first()
                    )
                    if sec and sec.rendered_card_url:
                        url = sec.rendered_card_url
                        print(
                            f"[wa_cards] invitation reusing organiser-prepared card url "
                            f"sent_id={sec.id} status={sec.delivery_status!r}"
                        )
            finally:
                _s.close()
        except Exception as exc:
            print(f"[wa_cards] prepared event-card lookup failed: {exc!r}")

        # 2) Stable per-recipient image_url — mirrors the pledge_thank_you_card
        # WhatsApp flow exactly: render once, persist URL on a card mapping,
        # reuse the same image_url on every resend so Meta receives an
        # unchanging media URL and no duplicate storage objects are created.
        # See backend/app/docs/card_url_mappings.md.
        if not url:
            try:
                from core.database import SessionLocal
                from services.card_url_service import (
                    get_existing_mapping,
                    generate_or_replace_card,
                )
                s = SessionLocal()
                try:
                    existing = get_existing_mapping(
                        s,
                        recipient_type="guest",
                        recipient_id=intl,
                        card_purpose="invitation",
                        event_id=str(event_id),
                        related_entity_type="invitation",
                        related_entity_id=str(guest_id),
                    )
                    if existing and existing.storage_url:
                        url = existing.storage_url
                        print(f"[wa_cards] invitation reusing stable url token={existing.token}")
                    else:
                        url = _render(render_payload)
                        if url:
                            try:
                                generate_or_replace_card(
                                    s,
                                    recipient_type="guest",
                                    recipient_id=intl,
                                    card_purpose="invitation",
                                    template_slug="invitation-card",
                                    event_id=str(event_id),
                                    related_entity_type="invitation",
                                    related_entity_id=str(guest_id),
                                    pre_uploaded_url=url,
                                )
                            except Exception as exc:
                                print(f"[wa_cards] invitation mapping persist failed: {exc!r}")
                finally:
                    s.close()
            except Exception as exc:
                print(f"[wa_cards] invitation stable-url lookup failed: {exc!r}")
                if not url:
                    url = _render(render_payload)

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
        # image_url passed exactly like pledge_thank_you_card: full public URL
        # consumed as Meta template image header. Approved template
        # invitation_card_{sw,en} expects six body params:
        # {{1}} guest_name · {{2}} organizer_name · {{3}} event_name ·
        # {{4}} event_date · {{5}} venue · {{6}} organizer_phone.
        try:
            from utils.datetime_format import format_event_datetime
            formatted_date = format_event_datetime(event_date, lang=(lang or "sw").lower()) or safe_date
        except Exception:
            formatted_date = safe_date
        _send("send_invitation_card", intl, {
            "image_url": url,
            "lang": (lang or "sw").lower(),
            "guest_name": safe_name,
            "organizer_name": safe_host,
            "event_name": safe_event,
            "event_date": formatted_date,
            "venue": (venue or "").strip() or "TBA",
            "organizer_phone": (organizer_phone or "").strip() or "—",
            # Powers the WhatsApp quick-reply RSVP buttons (confirm/maybe/decline).
            # Same code used by the /rsvp/{code} URL flow so the webhook can
            # update the existing EventInvitation row.
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
