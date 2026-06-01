"""
Admin: WhatsApp availability cache controls.

Mounted at /admin/whatsapp-availability/...
"""
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.database import get_db
from models.phone_whatsapp import PhoneWhatsAppStatus


router = APIRouter(prefix="/admin/whatsapp-availability",
                   tags=["Admin WhatsApp Availability"])


def _require_admin(request: Request, db: Session = Depends(get_db)):
    from api.routes.admin import require_admin
    return require_admin(request, db)


@router.get("/stats")
def stats(_admin=Depends(_require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(PhoneWhatsAppStatus.status, sa_func.count(PhoneWhatsAppStatus.id))
        .group_by(PhoneWhatsAppStatus.status)
        .all()
    )
    counts = {st: c for st, c in rows}
    total = sum(counts.values())
    return {
        "success": True,
        "data": {"total": total, "by_status": counts},
    }


@router.post("/backfill")
def trigger_backfill(
    _admin=Depends(_require_admin),
    queue_checks: bool = Query(True),
    limit: int = Query(5000, ge=1, le=50000),
):
    """Scan all known phone fields and seed phone_whatsapp_statuses."""
    from tasks.whatsapp_availability import backfill_all_phones
    res = backfill_all_phones.delay(queue_checks=queue_checks, limit=limit)
    return {"success": True, "data": {"task_id": str(res.id)}}


@router.post("/recheck-missing")
def trigger_recheck(_admin=Depends(_require_admin)):
    from tasks.whatsapp_availability import check_missing_statuses
    res = check_missing_statuses.delay()
    return {"success": True, "data": {"task_id": str(res.id)}}


@router.post("/refresh-stale")
def trigger_refresh(_admin=Depends(_require_admin)):
    from tasks.whatsapp_availability import refresh_stale_statuses
    res = refresh_stale_statuses.delay()
    return {"success": True, "data": {"task_id": str(res.id)}}
