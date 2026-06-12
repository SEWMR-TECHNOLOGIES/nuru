"""
WhatsApp Logs — user-facing dashboard endpoints
================================================
Every outbound WhatsApp attempt Nuru makes is recorded in
``wa_message_logs``. These endpoints power the "WhatsApp Logs" page
on the user dashboard so silent delivery failures become visible.

Endpoints (all auth-required, mounted at /api/v1):
  GET    /whatsapp/logs                      list + filters + pagination
  GET    /whatsapp/logs/stats                aggregate counts per status
  GET    /whatsapp/logs/{log_id}             full detail (payloads + history)
  POST   /whatsapp/logs/{log_id}/resend      retry a failed/rejected message

The resend action reuses the original purpose + request payload, increments
``retry_count`` on a brand-new attempt row linked back to the original via
``parent_log_id`` — the original failure record is preserved for audit.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, and_
from sqlalchemy.orm import Session

from core.database import get_db
from models import User
from models.wa_message_log import WAMessageLog
from utils.auth import get_current_user
from utils.helpers import standard_response, paginate

router = APIRouter(prefix="/whatsapp/logs", tags=["WhatsApp Logs"])


_RETRYABLE_STATUSES = {"failed", "rejected", "unknown"}


def _serialize(row: WAMessageLog, *, detail: bool = False) -> dict:
    data = {
        "id": str(row.id),
        "recipient_phone": row.recipient_phone,
        "normalized_phone": row.normalized_phone,
        "user_id": str(row.user_id) if row.user_id else None,
        "event_id": str(row.event_id) if row.event_id else None,
        "category": row.category,
        "action": row.action,
        "template_name": row.template_name,
        "message_type": row.message_type,
        "language": row.language,
        "direction": row.direction,
        "summary": row.summary,
        "media_url": row.media_url,
        "media_type": row.media_type,
        "provider": row.provider,
        "provider_message_id": row.provider_message_id,
        "status": row.status,
        "error_code": row.error_code,
        "error_message": row.error_message,
        "failure_reason": row.failure_reason,
        "retry_count": row.retry_count or 0,
        "parent_log_id": str(row.parent_log_id) if row.parent_log_id else None,
        "queued_at": row.queued_at.isoformat() if row.queued_at else None,
        "sent_at": row.sent_at.isoformat() if row.sent_at else None,
        "delivered_at": row.delivered_at.isoformat() if row.delivered_at else None,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "failed_at": row.failed_at.isoformat() if row.failed_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "retryable": row.status in _RETRYABLE_STATUSES,
    }
    if detail:
        data["request_payload"] = row.request_payload
        data["response_payload"] = row.response_payload
        data["webhook_payload"] = row.webhook_payload
    return data


def _phone_last9(phone: str) -> str:
    digits = "".join(c for c in (phone or "") if c.isdigit())
    return digits[-9:] if len(digits) >= 9 else digits


@router.get("")
def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=200),
    status: Optional[str] = None,
    category: Optional[str] = None,
    message_type: Optional[str] = None,
    template_name: Optional[str] = None,
    event_id: Optional[str] = None,
    recipient: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WAMessageLog)

    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if statuses:
            query = query.filter(WAMessageLog.status.in_(statuses))
    if category:
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if cats:
            query = query.filter(WAMessageLog.category.in_(cats))
    if message_type:
        query = query.filter(WAMessageLog.message_type == message_type)
    if template_name:
        query = query.filter(WAMessageLog.template_name.ilike(f"%{template_name}%"))
    if event_id:
        try:
            query = query.filter(WAMessageLog.event_id == uuid.UUID(event_id))
        except ValueError:
            raise HTTPException(400, "Invalid event_id")
    if recipient:
        last9 = _phone_last9(recipient)
        if last9:
            query = query.filter(or_(
                WAMessageLog.recipient_phone.ilike(f"%{last9}"),
                WAMessageLog.normalized_phone.ilike(f"%{last9}"),
            ))
        else:
            query = query.filter(WAMessageLog.recipient_phone.ilike(f"%{recipient}%"))
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            WAMessageLog.summary.ilike(like),
            WAMessageLog.action.ilike(like),
            WAMessageLog.template_name.ilike(like),
            WAMessageLog.error_message.ilike(like),
            WAMessageLog.failure_reason.ilike(like),
        ))
    if date_from:
        try:
            query = query.filter(WAMessageLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            raise HTTPException(400, "Invalid date_from (use ISO 8601)")
    if date_to:
        try:
            query = query.filter(WAMessageLog.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            raise HTTPException(400, "Invalid date_to (use ISO 8601)")

    query = query.order_by(desc(WAMessageLog.created_at), desc(WAMessageLog.id))
    items, pagination = paginate(query, page, limit)
    data = [_serialize(r) for r in items]
    return standard_response(True, "WhatsApp logs retrieved", data, pagination=pagination)


@router.get("/stats")
def stats(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(WAMessageLog.status, func.count(WAMessageLog.id))
          .filter(WAMessageLog.created_at >= since)
          .group_by(WAMessageLog.status)
          .all()
    )
    counts = {s: int(c) for s, c in rows}
    total = sum(counts.values())
    counts["total"] = total
    return standard_response(True, "Stats", counts)


@router.get("/{log_id}")
def get_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(log_id)
    except ValueError:
        raise HTTPException(400, "Invalid log id")
    row = db.query(WAMessageLog).filter(WAMessageLog.id == lid).first()
    if not row:
        raise HTTPException(404, "Log not found")

    history = (
        db.query(WAMessageLog)
          .filter(or_(
              WAMessageLog.parent_log_id == lid,
              WAMessageLog.id == (row.parent_log_id or lid),
              WAMessageLog.parent_log_id == (row.parent_log_id or lid),
          ))
          .order_by(WAMessageLog.created_at.asc())
          .all()
    )

    data = _serialize(row, detail=True)
    data["history"] = [_serialize(h) for h in history if str(h.id) != str(row.id)]
    return standard_response(True, "Log detail", data)


@router.post("/{log_id}/resend")
def resend_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Safely retry a failed/rejected message.

    Reuses the original purpose + payload. Creates a fresh attempt row
    (parent_log_id = original) so the historical failure stays for audit.
    """
    try:
        lid = uuid.UUID(log_id)
    except ValueError:
        raise HTTPException(400, "Invalid log id")
    row = db.query(WAMessageLog).filter(WAMessageLog.id == lid).first()
    if not row:
        raise HTTPException(404, "Log not found")
    if row.status not in _RETRYABLE_STATUSES:
        raise HTTPException(400, f"Cannot resend a message in status '{row.status}'")
    if not row.action:
        raise HTTPException(400, "Original action is missing — cannot resend")

    req = row.request_payload or {}
    if isinstance(req, dict) and "params" in req:
        params = req.get("params") or {}
    else:
        params = req if isinstance(req, dict) else {}

    # Create the new attempt row first, then dispatch with its id so the
    # send pipeline updates this row instead of creating another.
    from utils.wa_logging import log_attempt
    new_id = log_attempt(
        action=row.action,
        phone=row.recipient_phone,
        params=params,
        parent_log_id=str(row.id),
        retry_count=(row.retry_count or 0) + 1,
    )
    if not new_id:
        raise HTTPException(500, "Failed to create retry log row")

    from utils.whatsapp import _send_whatsapp
    _send_whatsapp(row.action, row.recipient_phone, params, log_id=new_id)

    new_row = db.query(WAMessageLog).filter(WAMessageLog.id == new_id).first()
    return standard_response(True, "Resend queued", _serialize(new_row) if new_row else {"id": new_id})
