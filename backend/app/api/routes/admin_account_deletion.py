"""Admin account-deletion request management.

Mounted under /admin/account-deletion/*.
"""
import uuid
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Body, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from core.database import get_db
from models.account_deletion import AccountDeletionRequest
from models import AdminUser
from api.routes.admin import _get_admin_from_token
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/admin/account-deletion", tags=["Admin · AccountDeletion"])

VALID_STATUSES = {"pending", "in_progress", "completed", "rejected"}


def _require_admin(request: Request, db: Session) -> AdminUser:
    auth = request.headers.get("authorization") or ""
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    return _get_admin_from_token(token, db)


def _serialise(r: AccountDeletionRequest) -> dict:
    return {
        "id": str(r.id),
        "user_id": str(r.user_id) if r.user_id else None,
        "full_name": r.full_name,
        "email": r.email,
        "phone": r.phone,
        "reason": r.reason,
        "delete_scope": r.delete_scope,
        "source": r.source,
        "status": r.status,
        "admin_notes": r.admin_notes,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("")
def list_requests(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _require_admin(request, db)
    query = db.query(AccountDeletionRequest)
    if status and status in VALID_STATUSES:
        query = query.filter(AccountDeletionRequest.status == status)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            AccountDeletionRequest.email.ilike(like),
            AccountDeletionRequest.full_name.ilike(like),
            AccountDeletionRequest.phone.ilike(like),
        ))
    query = query.order_by(desc(AccountDeletionRequest.created_at))
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "Deletion requests retrieved", {
        "items": [_serialise(r) for r in items],
        "pagination": pagination,
    })


@router.get("/stats")
def stats(request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    rows = db.query(AccountDeletionRequest.status).all()
    counts = {"total": len(rows), "pending": 0, "in_progress": 0, "completed": 0, "rejected": 0}
    for (s,) in rows:
        if s in counts:
            counts[s] += 1
    return standard_response(True, "Stats retrieved", counts)


@router.put("/{req_id}/status")
def update_status(req_id: str, request: Request, body: dict = Body(...), db: Session = Depends(get_db)):
    admin = _require_admin(request, db)
    try:
        rid = uuid.UUID(req_id)
    except ValueError:
        return standard_response(False, "Invalid id")
    new_status = (body.get("status") or "").strip().lower()
    if new_status not in VALID_STATUSES:
        return standard_response(False, "Invalid status")
    r = db.query(AccountDeletionRequest).filter(AccountDeletionRequest.id == rid).first()
    if not r:
        return standard_response(False, "Request not found")
    r.status = new_status
    r.handled_by_admin_id = admin.id
    if new_status == "completed":
        r.completed_at = datetime.now(EAT)
    db.commit()
    db.refresh(r)
    return standard_response(True, "Status updated", _serialise(r))


@router.put("/{req_id}/notes")
def update_notes(req_id: str, request: Request, body: dict = Body(...), db: Session = Depends(get_db)):
    _require_admin(request, db)
    try:
        rid = uuid.UUID(req_id)
    except ValueError:
        return standard_response(False, "Invalid id")
    r = db.query(AccountDeletionRequest).filter(AccountDeletionRequest.id == rid).first()
    if not r:
        return standard_response(False, "Request not found")
    r.admin_notes = (body.get("notes") or "")[:4000] or None
    db.commit()
    return standard_response(True, "Notes updated", _serialise(r))


@router.delete("/{req_id}")
def delete_request(req_id: str, request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    try:
        rid = uuid.UUID(req_id)
    except ValueError:
        return standard_response(False, "Invalid id")
    r = db.query(AccountDeletionRequest).filter(AccountDeletionRequest.id == rid).first()
    if r:
        db.delete(r)
        db.commit()
    return standard_response(True, "Request deleted")