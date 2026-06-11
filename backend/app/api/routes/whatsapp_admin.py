# WhatsApp Admin Routes - /admin/whatsapp/...
# Admin endpoints for WhatsApp conversation management
# Plus the public Meta webhook callback (/whatsapp/webhook) that Meta
# Cloud API calls directly. This replaces the old Supabase edge function
# relay — Meta now POSTs straight into the backend so status updates
# feed phone_whatsapp_statuses without an extra hop.

import os
import re
import uuid
from datetime import datetime

import pytz
from sqlalchemy.orm import joinedload
import requests
from fastapi import APIRouter, Depends, Body, Query, Request, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from core.database import get_db
from models import WAConversation, WAMessage, WAMessageDirectionEnum, WAMessageStatusEnum, AdminUser, User, UserProfile
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(tags=["WhatsApp"])

# Import admin auth dependency from admin routes
from api.routes.admin import require_admin


def _mirror_delivery_status(db: Session, wa_message_id: str, status: str, error_message: str | None = None):
    if not wa_message_id or not status:
        return
    try:
        msg = db.query(WAMessage).filter(WAMessage.wa_message_id == wa_message_id).first()
        if msg:
            order = {"sent": 0, "delivered": 1, "read": 2, "failed": -1}
            try:
                new_status = WAMessageStatusEnum(status)
            except ValueError:
                new_status = None
            if new_status is not None:
                cur = order.get(msg.status.value if msg.status else "sent", 0)
                nxt = order.get(status, 0)
                if status == "failed" or nxt > cur:
                    msg.status = new_status
        try:
            from models import SentEventCard
            sent_card = db.query(SentEventCard).filter(SentEventCard.whatsapp_message_id == wa_message_id).first()
            if sent_card:
                sent_card.delivery_status = status
                if error_message:
                    sent_card.error_message = error_message
        except Exception as e:  # noqa: BLE001
            print(f"[wa-webhook] sent card status mirror failed: {e}")
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"[wa-webhook] local status mirror failed: {e}")

EDGE_FUNCTION_URL = os.getenv("EDGE_FUNCTION_URL", "") or os.getenv("SUPABASE_URL", "")
EDGE_FUNCTION_KEY = os.getenv("EDGE_FUNCTION_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_SEND_URL = f"{EDGE_FUNCTION_URL}/functions/v1/whatsapp-send" if EDGE_FUNCTION_URL else ""
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Meta WhatsApp Cloud API credentials — used by the direct webhook handler
# below to verify Meta's subscription challenge and to send bot replies.
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
API_BASE_URL = os.getenv("BACKEND_BASE_URL", "") or os.getenv("API_BASE_URL", "")

# ──────────────────────────────────────────────
# INTERNAL: Webhook stores incoming messages
# ──────────────────────────────────────────────

@router.post("/whatsapp/incoming")
def store_incoming_message(body: dict = Body(...), db: Session = Depends(get_db)):
    """Called by the whatsapp-webhook edge function to store an incoming message."""
    phone = (body.get("phone") or "").strip()
    content = (body.get("content") or "").strip()
    wa_message_id = body.get("wa_message_id")
    contact_name = body.get("contact_name", "")

    if not phone or not content:
        return standard_response(False, "Phone and content required")

    # Check duplicate wa_message_id before touching unread counters. Meta may
    # retry webhooks, and duplicate retries must not create phantom unread 2s.
    if wa_message_id:
        existing = db.query(WAMessage).filter(WAMessage.wa_message_id == wa_message_id).first()
        if existing:
            return standard_response(True, "Duplicate message, skipped")

    # Find or create conversation
    conv = db.query(WAConversation).filter(WAConversation.phone == phone).first()
    now = datetime.now(EAT)

    if not conv:
        conv = WAConversation(
            phone=phone,
            contact_name=contact_name or phone,
            last_message=content[:200],
            last_activity_at=now,
            unread_count=1,
        )
        db.add(conv)
        db.flush()
    else:
        if contact_name and (not conv.contact_name or conv.contact_name == conv.phone):
            conv.contact_name = contact_name
        conv.last_message = content[:200]
        conv.last_activity_at = now
        conv.unread_count = (conv.unread_count or 0) + 1

    msg = WAMessage(
        conversation_id=conv.id,
        wa_message_id=wa_message_id,
        direction=WAMessageDirectionEnum.inbound,
        content=content,
        status=WAMessageStatusEnum.delivered,
    )
    db.add(msg)
    db.commit()
    return standard_response(True, "Message stored", {"conversation_id": str(conv.id)})


@router.post("/whatsapp/status-update")
def store_status_update(body: dict = Body(...), db: Session = Depends(get_db)):
    """Called by the whatsapp-webhook edge function to update message status.

    Two side-effects:
      1. Bump our local WAMessage row status (sent/delivered/read).
      2. Feed the authoritative delivery signal into
         phone_whatsapp_statuses so the WhatsApp availability badge only
         lights up after Meta has actually delivered (or rejected) the
         message — see utils.whatsapp_availability.record_delivery_outcome.
    """
    wa_message_id = body.get("wa_message_id")
    status = body.get("status")  # sent, delivered, read, failed
    recipient_phone = body.get("recipient_phone") or body.get("recipient_id")
    errors = body.get("errors")  # webhook errors array, optional
    error_message = None

    if not wa_message_id or not status:
        return standard_response(False, "wa_message_id and status required")

    # ── 1. Update phone_whatsapp_statuses based on the REAL delivery callback.
    #     Done first so even messages we never persisted (older sends, system
    #     templates, etc.) still teach the availability cache.
    try:
        if recipient_phone:
            from utils.whatsapp_availability import record_delivery_outcome
            error_code = None
            if isinstance(errors, list) and errors:
                first = errors[0] or {}
                error_code = str(first.get("code")) if first.get("code") is not None else None
                error_message = first.get("title") or first.get("message") or first.get("details")
            record_delivery_outcome(
                db, recipient_phone,
                delivery_status=str(status),
                error_code=error_code,
                error_message=error_message,
            )
    except Exception as e:  # noqa: BLE001
        print(f"[whatsapp] delivery callback record skipped: {e}")

    # ── 2. Local WAMessage status bump (unchanged behaviour).
    _mirror_delivery_status(db, wa_message_id, str(status), error_message)

    return standard_response(True, "Status updated")



# ──────────────────────────────────────────────
# ADMIN: Conversation management
# ──────────────────────────────────────────────

@router.get("/admin/whatsapp/conversations")
def list_wa_conversations(
    page: int = 1, limit: int = 30,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List WhatsApp conversations sorted by most recent activity."""
    query = db.query(WAConversation).filter(WAConversation.is_active == True)
    if q:
        search = f"%{q}%"
        query = query.filter(
            WAConversation.contact_name.ilike(search) |
            WAConversation.phone.ilike(search)
        )
    query = query.order_by(desc(WAConversation.last_activity_at), desc(WAConversation.id))
    items, pagination = paginate(query, page, limit)

    # Look up Nuru user avatars + names by matching phone numbers (last 9 digits)
    avatar_map: dict = {}
    name_map: dict = {}
    for c in items:
        if c.phone:
            last9 = c.phone[-9:] if len(c.phone) >= 9 else c.phone
            user = (
                db.query(User)
                .options(joinedload(User.profile))
                .filter(User.phone.ilike(f"%{last9}"))
                .first()
            )
            if user:
                if user.profile and user.profile.profile_picture_url:
                    avatar_map[c.id] = user.profile.profile_picture_url
                full = (getattr(user, "full_name", None)
                        or (user.profile and getattr(user.profile, "full_name", None)))
                if full:
                    name_map[c.id] = full

    data = [{
        "id": str(c.id),
        "phone": c.phone,
        "contact_name": (
            c.contact_name
            if (c.contact_name and c.contact_name != c.phone)
            else (name_map.get(c.id) or c.phone)
        ),
        "last_message": c.last_message or "",
        "last_activity_at": c.last_activity_at.isoformat() if c.last_activity_at else None,
        "unread_count": c.unread_count or 0,
        "avatar_url": avatar_map.get(c.id),
    } for c in items]

    return standard_response(True, "Conversations retrieved", data, pagination=pagination)


@router.get("/admin/whatsapp/conversations/{conversation_id}/messages")
def get_wa_messages(
    conversation_id: str,
    page: int = 1, limit: int = 50,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Get paginated messages for a WhatsApp conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(WAConversation).filter(WAConversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    query = db.query(WAMessage).filter(
        WAMessage.conversation_id == cid
    ).order_by(desc(WAMessage.created_at), desc(WAMessage.id))

    items, pagination = paginate(query, page, limit)

    data = [{
        "id": str(m.id),
        "direction": m.direction.value if m.direction else "inbound",
        "content": m.content,
        "media_url": m.media_url,
        "media_type": m.media_type,
        "status": m.status.value if m.status else "sent",
        "wa_message_id": m.wa_message_id,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in reversed(items)]  # reverse so oldest first

    return standard_response(True, "Messages retrieved", data, pagination=pagination)


@router.post("/admin/whatsapp/conversations/{conversation_id}/send")
def send_wa_message(
    conversation_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Admin sends a WhatsApp message to a conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(WAConversation).filter(WAConversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    content = (body.get("content") or "").strip()
    if not content:
        return standard_response(False, "Message content is required")

    # Send via whatsapp-send edge function
    wa_message_id = None
    if WHATSAPP_SEND_URL and SUPABASE_ANON_KEY:
        try:
            resp = requests.post(
                WHATSAPP_SEND_URL,
                json={"action": "text", "phone": conv.phone, "params": {"message": content}},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "apikey": SUPABASE_ANON_KEY,
                },
                timeout=15,
            )
            if resp.ok:
                result = resp.json()
                wa_message_id = result.get("message_id")
            else:
                return standard_response(False, f"WhatsApp API failed: {resp.text[:200]}")
        except Exception as e:
            return standard_response(False, f"Failed to send WhatsApp message: {str(e)}")
    else:
        return standard_response(False, "WhatsApp sending is not configured")

    now = datetime.now(EAT)
    msg = WAMessage(
        conversation_id=cid,
        wa_message_id=wa_message_id,
        direction=WAMessageDirectionEnum.outbound,
        content=content,
        status=WAMessageStatusEnum.sent,
    )
    db.add(msg)
    conv.last_message = content[:200]
    conv.last_activity_at = now
    db.commit()
    db.refresh(msg)

    return standard_response(True, "Message sent", {
        "id": str(msg.id),
        "content": msg.content,
        "direction": "outbound",
        "status": "sent",
        "wa_message_id": wa_message_id,
        "created_at": msg.created_at.isoformat() if msg.created_at else now.isoformat(),
    })


@router.put("/admin/whatsapp/conversations/{conversation_id}/read")
def mark_wa_conversation_read(
    conversation_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Mark all messages in a conversation as read and reset unread count."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(WAConversation).filter(WAConversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    conv.unread_count = 0
    db.commit()
    return standard_response(True, "Conversation marked as read")


# ──────────────────────────────────────────────────────────────────────
# PUBLIC: Meta Cloud API webhook — called directly by Meta
# ──────────────────────────────────────────────────────────────────────
# Configure in Meta App → WhatsApp → Configuration → Callback URL:
#     {BACKEND_BASE_URL}/whatsapp/webhook
# Verify token must match the WHATSAPP_VERIFY_TOKEN env var.
#
# This endpoint REPLACES the old supabase/functions/whatsapp-webhook relay.
# Meta now POSTs straight into the backend so:
#   • status callbacks update phone_whatsapp_statuses via record_delivery_outcome
#   • incoming messages are stored locally without a hop through Supabase

_TITLE_PATTERN = re.compile(
    r"^((?:(?:Dr|Prof|Eng|Mr|Mrs|Ms|Miss|Mx|Hon|Rev|Pr|Sr|Jr|Capt|Col|Gen|Sgt|Cpl|Lt|Maj|"
    r"Amb|Dkt|Mheshimiwa|Mwl|Sheikh|Imam|Bishop|Pastor|Father|Fr|Sister|Br|Brother|"
    r"Dame|Sir|Lady|Lord|Chief|Justice|Judge|Adv|Advocate|Barrister|Solicitor|Atty|CPA|"
    r"Arch|Comm|Comdr|Admiral|Cmdr|Brig|Pvt|Cdr|Gov|Pres|PM|VP|MP|Sen|Dip|Pharm|Nurse|"
    r"Nrs|Doc|Dcn|Elder|Apostle|Prophet|Evangelist|Canon|Cardinal|Msgr|Monsignor|"
    r"Abbess|Abbot|Prior|Prioress|Deacon|Vicar|Curate|Chaplain|Min|Mch)\.?\s+)+)(\S+)",
    re.IGNORECASE,
)


def _extract_first_name(full_name: str) -> str:
    trimmed = (full_name or "").strip()
    if not trimmed:
        return "Guest"
    m = _TITLE_PATTERN.match(trimmed)
    if m:
        title = (m.group(1) or "").strip()
        first = m.group(2) or ""
        return f"{title} {first}" if title else first
    return trimmed.split()[0] if trimmed.split() else "Guest"


def _fetch_media_url(media_id: str) -> str | None:
    """Resolve a Meta media_id to a downloadable URL.
    Meta returns a short-lived signed URL; admins viewing recent messages
    will be able to load the image directly. Older URLs may expire — that's
    acceptable for this inbox use case."""
    if not (media_id and WHATSAPP_ACCESS_TOKEN):
        return None
    try:
        resp = requests.get(
            f"https://graph.facebook.com/v21.0/{media_id}",
            headers={"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"},
            timeout=10,
        )
        if not resp.ok:
            return None
        return (resp.json() or {}).get("url")
    except Exception:
        return None


def _send_whatsapp_text(to: str, body: str):
    """Send a plain WhatsApp text via Meta Cloud API. Returns wa_message_id or None."""
    if not (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID):
        return None
    try:
        url = f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": body},
            },
            timeout=15,
        )
        if not resp.ok:
            print(f"[wa-webhook] send failed to={to}: {resp.text[:200]}")
            return None
        data = resp.json()
        return (data.get("messages") or [{}])[0].get("id")
    except Exception as e:  # noqa: BLE001
        print(f"[wa-webhook] send error to={to}: {e}")
        return None


def _store_incoming(db: Session, *, phone: str, content: str,
                    wa_message_id: str | None, contact_name: str,
                    direction: str = "inbound",
                    media_url: str | None = None,
                    media_type: str | None = None,
                    status: str | None = None):
    if not phone or (not content and not media_url):
        return
    if wa_message_id:
        existing = db.query(WAMessage).filter(WAMessage.wa_message_id == wa_message_id).first()
        if existing:
            return
    now = datetime.now(EAT)
    conv = db.query(WAConversation).filter(WAConversation.phone == phone).first()
    if not conv:
        conv = WAConversation(
            phone=phone,
            contact_name=contact_name or phone,
            last_message=(content or ("[image]" if media_url else ""))[:200],
            last_activity_at=now,
            unread_count=1 if direction == "inbound" else 0,
        )
        db.add(conv)
        db.flush()
    else:
        if contact_name and (not conv.contact_name or conv.contact_name == conv.phone):
            conv.contact_name = contact_name
        conv.last_message = (content or ("[image]" if media_url else ""))[:200]
        conv.last_activity_at = now
        if direction == "inbound":
            conv.unread_count = (conv.unread_count or 0) + 1

    dir_enum = WAMessageDirectionEnum.inbound if direction == "inbound" else WAMessageDirectionEnum.outbound
    try:
        msg_status = WAMessageStatusEnum(status) if status else None
    except ValueError:
        msg_status = None
    msg = WAMessage(
        conversation_id=conv.id,
        wa_message_id=wa_message_id,
        direction=dir_enum,
        content=content or "",
        media_url=media_url,
        media_type=media_type,
        status=msg_status or (WAMessageStatusEnum.delivered if direction == "inbound" else WAMessageStatusEnum.sent),
    )
    db.add(msg)
    db.commit()


def _lookup_guest_for_phone(phone: str):
    """Resolve invitation code + guest name for a phone. Uses local helpers."""
    try:
        from api.routes.rsvp import _lookup_by_phone  # type: ignore
        return _lookup_by_phone(phone)
    except Exception:
        return None


@router.get("/whatsapp/webhook")
def whatsapp_webhook_verify(request: Request):
    """Meta subscription verification handshake."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge") or ""
    if mode == "subscribe" and token and WHATSAPP_VERIFY_TOKEN and token == WHATSAPP_VERIFY_TOKEN:
        return Response(content=challenge, media_type="text/plain", status_code=200)
    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/whatsapp/webhook")
def whatsapp_webhook_receive(body: dict = Body(...), db: Session = Depends(get_db)):
    """Receive Meta Cloud API webhook payload directly.

    Handles:
      • statuses[] — feeds record_delivery_outcome so phone_whatsapp_statuses
        only marks numbers as WhatsApp once Meta confirms delivery.
      • messages[] — stores inbound messages and (optionally) replies to
        RSVP keywords (YES / NO / HELP).

    Always returns 200 so Meta does not retry on transient failures —
    individual errors are logged.
    """
    try:
        entry = (body.get("entry") or [{}])[0]
        change = (entry.get("changes") or [{}])[0]
        value = change.get("value") or {}

        # ── 1. Delivery status callbacks ───────────────────────────────
        statuses = value.get("statuses") or []
        if statuses:
            from utils.whatsapp_availability import record_delivery_outcome
            for st in statuses:
                wamid = st.get("id")
                status = (st.get("status") or "").lower()  # sent/delivered/read/failed
                recipient = st.get("recipient_id") or st.get("recipient_phone")
                errs = st.get("errors") or []
                error_code = None
                error_message = None
                if errs:
                    first = errs[0] or {}
                    error_code = str(first.get("code")) if first.get("code") is not None else None
                    error_message = first.get("title") or first.get("message") or first.get("details")

                # Update authoritative availability cache.
                if recipient and status:
                    try:
                        record_delivery_outcome(
                            db, recipient,
                            delivery_status=status,
                            error_code=error_code,
                            error_message=error_message,
                        )
                    except Exception as e:  # noqa: BLE001
                        print(f"[wa-webhook] availability update failed: {e}")

                # Mirror the bump to local wa_messages and sent_event_cards.
                if wamid and status:
                    _mirror_delivery_status(db, wamid, status, error_message)

        # ── 2. Incoming messages ──────────────────────────────────────
        messages = value.get("messages") or []
        if not messages:
            return {"status": "ok"}
        message = messages[0]
        from_phone = message.get("from") or ""
        text = ((message.get("text") or {}).get("body") or "").strip()
        contacts = value.get("contacts") or []
        wa_name = ((contacts[0].get("profile") or {}).get("name") if contacts else "") or "Guest"
        wamid_in = message.get("id")

        # Resolve a stored representation of the inbound message.
        interactive = (message.get("interactive") or {}).get("button_reply") or {}
        template_btn = message.get("button") or {}
        stored_content = interactive.get("title") or template_btn.get("text") or text

        # Inbound media (image / document / video / audio) — fetch a temporary
        # CDN-style URL from Meta so the admin inbox can display it.
        media_url = None
        media_type = None
        for mt in ("image", "document", "video", "audio"):
            obj = message.get(mt)
            if obj and obj.get("id"):
                media_type = mt
                stored_content = stored_content or obj.get("caption") or f"[{mt}]"
                try:
                    media_url = _fetch_media_url(obj.get("id"))
                except Exception as e:  # noqa: BLE001
                    print(f"[wa-webhook] fetch media url failed: {e}")
                break

        if stored_content or media_url:
            try:
                _store_incoming(
                    db,
                    phone=from_phone,
                    content=stored_content or "",
                    wa_message_id=wamid_in,
                    contact_name=wa_name,
                    media_url=media_url,
                    media_type=media_type,
                )
            except Exception as e:  # noqa: BLE001
                print(f"[wa-webhook] store inbound failed: {e}")

        # ── 3. RSVP bot replies ───────────────────────────────────────
        reply_text = ""
        try:
            button_payload = interactive.get("id") or template_btn.get("payload") or ""
            from api.routes import rsvp as rsvp_module  # type: ignore
            lookup = None
            try:
                if hasattr(rsvp_module, "_lookup_by_phone"):
                    lookup = rsvp_module._lookup_by_phone(from_phone, db=db)  # type: ignore
            except Exception:
                lookup = None
            guest_full = (lookup or {}).get("guest_name") if isinstance(lookup, dict) else None
            guest_display_name = (guest_full or wa_name or "Guest").strip()
            invitation_code = (lookup or {}).get("code") if isinstance(lookup, dict) else None

            def _do_rsvp(code, status):
                if not code:
                    return f"Sorry {guest_display_name}, I couldn't find an invitation linked to your number."
                applied = False
                try:
                    if hasattr(rsvp_module, "_respond_internal"):
                        applied = bool(rsvp_module._respond_internal(db, code, status))  # type: ignore
                except Exception as e:  # noqa: BLE001
                    print(f"[wa-webhook] rsvp respond failed: {e}")
                if not applied:
                    return f"Sorry {guest_display_name}, I couldn't update your RSVP. Please open the invitation link and try again."
                if status == "confirmed":
                    return f"Great news {guest_display_name}! Your attendance has been confirmed."
                if status == "maybe":
                    return (
                        f"Thanks {guest_display_name}, we've noted that you might attend. "
                        "Tap Confirm or Decline anytime to update your response."
                    )
                return f"Thank you {guest_display_name}. Your response has been recorded."

            if button_payload:
                m_conf = re.match(r"^rsvp_confirm_(.+)$", button_payload)
                m_maybe = re.match(r"^rsvp_maybe_(.+)$", button_payload)
                m_dec = re.match(r"^rsvp_decline_(.+)$", button_payload)
                if m_conf:
                    reply_text = _do_rsvp(m_conf.group(1), "confirmed")
                elif m_maybe:
                    reply_text = _do_rsvp(m_maybe.group(1), "maybe")
                elif m_dec:
                    reply_text = _do_rsvp(m_dec.group(1), "declined")
            elif text:
                up = text.upper()
                if up in ("YES", "CONFIRM"):
                    reply_text = _do_rsvp(invitation_code, "confirmed")
                elif up in ("NO", "DECLINE"):
                    reply_text = _do_rsvp(invitation_code, "declined")
                elif up in ("MAYBE", "TENTATIVE"):
                    reply_text = _do_rsvp(invitation_code, "maybe")
                elif up == "HELP":
                    reply_text = (
                        f"Hi {first_name}! Here's how to use Nuru:\n\n"
                        "YES or CONFIRM: Accept an invitation\n"
                        "MAYBE: Mark that you might attend\n"
                        "NO or DECLINE: Decline an invitation\n"
                        "HELP: Show this menu"
                    )
        except Exception as e:  # noqa: BLE001
            print(f"[wa-webhook] bot reply skipped: {e}")
            reply_text = ""

        if reply_text:
            sent_id = _send_whatsapp_text(from_phone, reply_text)
            if sent_id:
                try:
                    _store_incoming(
                        db, phone=from_phone, content=reply_text,
                        wa_message_id=sent_id, contact_name="Nuru Bot",
                        direction="outbound",
                    )
                except Exception:
                    pass

        return {"status": "ok"}
    except Exception as e:  # noqa: BLE001
        print(f"[wa-webhook] processing failed: {e}")
        return {"status": "error"}
