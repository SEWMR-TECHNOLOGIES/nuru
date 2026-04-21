"""Public contact form endpoint — anonymous, rate-limited at the middleware layer.

POST /contact/submit
"""
import re
import uuid
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Body, Request
from sqlalchemy.orm import Session

from core.database import get_db
from models.contact import ContactMessage
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/contact", tags=["Contact"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _clean(s: Optional[str], maxlen: int) -> str:
    if not s:
        return ""
    return str(s).strip()[:maxlen]


@router.post("/submit")
def submit_contact_message(
    body: dict = Body(...),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Accept a contact form submission from any visitor (no auth)."""
    first_name = _clean(body.get("first_name"), 100)
    last_name = _clean(body.get("last_name"), 100)
    email = _clean(body.get("email"), 255).lower()
    phone = _clean(body.get("phone"), 32) or None
    subject = _clean(body.get("subject"), 200) or None
    message = _clean(body.get("message"), 4000)
    source_page = _clean(body.get("source_page"), 200) or None

    # ── Validation ──
    if not first_name:
        return standard_response(False, "First name is required")
    if not last_name:
        return standard_response(False, "Last name is required")
    if not email or not EMAIL_RE.match(email):
        return standard_response(False, "A valid email address is required")
    if not message or len(message) < 10:
        return standard_response(False, "Please share a few sentences (at least 10 characters)")

    # ── Request metadata ──
    ua = None
    host = None
    ip = None
    try:
        if request is not None:
            ua = (request.headers.get("user-agent") or "")[:500] or None
            host = (request.headers.get("host") or "")[:200] or None
            # Honour proxy headers when present
            xff = request.headers.get("x-forwarded-for") or ""
            ip = (xff.split(",")[0].strip() if xff else (request.client.host if request.client else ""))[:64] or None
    except Exception:
        pass

    msg = ContactMessage(
        id=uuid.uuid4(),
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        subject=subject,
        message=message,
        source_page=source_page,
        source_host=host,
        user_agent=ua,
        ip_address=ip,
        status="new",
        created_at=datetime.now(EAT),
    )
    db.add(msg)
    db.commit()

    return standard_response(
        True,
        "Message received — the Nuru team will get back to you shortly.",
        {"id": str(msg.id)},
    )
