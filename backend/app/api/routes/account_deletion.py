"""Public account-deletion request endpoint.

Anyone (anonymous or authenticated) may POST a deletion request.
POST /account-deletion/submit
"""
import re
import uuid
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Body, Request
from sqlalchemy.orm import Session

from core.database import get_db
from models.account_deletion import AccountDeletionRequest
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/account-deletion", tags=["AccountDeletion"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _clean(s: Optional[str], maxlen: int) -> str:
    if not s:
        return ""
    return str(s).strip()[:maxlen]


@router.post("/submit")
def submit_deletion_request(
    body: dict = Body(...),
    request: Request = None,
    db: Session = Depends(get_db),
):
    full_name = _clean(body.get("full_name"), 200)
    email = _clean(body.get("email"), 255).lower()
    phone = _clean(body.get("phone"), 32) or None
    reason = _clean(body.get("reason"), 2000) or None
    scope = _clean(body.get("delete_scope"), 40) or "account_and_data"
    if scope not in ("account_and_data", "data_only"):
        scope = "account_and_data"
    source = _clean(body.get("source"), 40) or "web"

    if not full_name:
        return standard_response(False, "Full name is required")
    if not email or not EMAIL_RE.match(email):
        return standard_response(False, "A valid email address is required")

    ua = host = ip = None
    try:
        if request is not None:
            ua = (request.headers.get("user-agent") or "")[:500] or None
            host = (request.headers.get("host") or "")[:200] or None
            xff = request.headers.get("x-forwarded-for") or ""
            ip = (xff.split(",")[0].strip() if xff else (request.client.host if request.client else ""))[:64] or None
    except Exception:
        pass

    req = AccountDeletionRequest(
        id=uuid.uuid4(),
        full_name=full_name,
        email=email,
        phone=phone,
        reason=reason,
        delete_scope=scope,
        source=source or host,
        user_agent=ua,
        ip_address=ip,
        status="pending",
        created_at=datetime.now(EAT),
    )
    db.add(req)
    db.commit()

    return standard_response(
        True,
        "Deletion request received. Our team will process it within 30 days and email you when complete.",
        {"id": str(req.id)},
    )