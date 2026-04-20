"""Admin endpoints for managing withdrawal requests.

GET   /admin/withdrawals                   → list (filter by status)
GET   /admin/withdrawals/{id}              → details
POST  /admin/withdrawals/{id}/approve      → mark approved (still held)
POST  /admin/withdrawals/{id}/settle       → record external payout sent
                                              → wallet `withdrawal()` ledger entry
POST  /admin/withdrawals/{id}/reject       → release held funds back to available
"""
from datetime import datetime
from decimal import Decimal
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from core.database import get_db
from utils.helpers import api_response, paginate
from api.routes.admin import require_admin
from models.payments import Wallet
from models.withdrawal_requests import WithdrawalRequest
from models.enums import WithdrawalRequestStatusEnum
from services.wallet_service import release, withdrawal as wallet_withdrawal


router = APIRouter(prefix="/admin/withdrawals", tags=["admin-withdrawals"])


def _serialize(w: WithdrawalRequest) -> dict:
    return {
        "id": str(w.id),
        "request_code": w.request_code,
        "user_id": str(w.user_id),
        "wallet_id": str(w.wallet_id),
        "payment_profile_id": str(w.payment_profile_id) if w.payment_profile_id else None,
        "currency_code": w.currency_code,
        "amount": float(w.amount or 0),
        "user_note": w.user_note,
        "payout_method": w.payout_method,
        "payout_provider_name": w.payout_provider_name,
        "payout_account_holder": w.payout_account_holder,
        "payout_account_number": w.payout_account_number,
        "payout_snapshot": w.payout_snapshot,
        "status": w.status.value if w.status else None,
        "admin_note": w.admin_note,
        "admin_user_id": str(w.admin_user_id) if w.admin_user_id else None,
        "external_reference": w.external_reference,
        "requested_at": w.requested_at.isoformat() if w.requested_at else None,
        "reviewed_at": w.reviewed_at.isoformat() if w.reviewed_at else None,
        "settled_at": w.settled_at.isoformat() if w.settled_at else None,
    }


def _load(db: Session, withdrawal_id: str) -> WithdrawalRequest:
    try:
        wid = uuid_lib.UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal_id.")
    wd = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == wid).first()
    if not wd:
        raise HTTPException(status_code=404, detail="Withdrawal not found.")
    return wd


@router.get("")
def admin_list(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    q = db.query(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc())
    if status:
        q = q.filter(WithdrawalRequest.status == status)
    items, pagination = paginate(q, page=page, limit=limit)
    return api_response(True, "Withdrawals retrieved.", {
        "withdrawals": [_serialize(w) for w in items],
        "pagination": pagination,
    })


@router.get("/{withdrawal_id}")
def admin_get(
    withdrawal_id: str,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    return api_response(True, "Withdrawal retrieved.", _serialize(_load(db, withdrawal_id)))


@router.post("/{withdrawal_id}/approve")
async def admin_approve(
    withdrawal_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
):
    """Acknowledge approval — funds remain held until /settle."""
    wd = _load(db, withdrawal_id)
    if wd.status != WithdrawalRequestStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Only pending withdrawals can be approved.")
    payload = (await request.json()) if (await request.body()) else {}
    wd.status = WithdrawalRequestStatusEnum.approved
    wd.admin_note = (payload.get("note") or "").strip() or wd.admin_note
    wd.admin_user_id = admin.id if hasattr(admin, "id") else wd.admin_user_id
    wd.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(wd)
    return api_response(True, "Withdrawal approved.", _serialize(wd))


@router.post("/{withdrawal_id}/settle")
async def admin_settle(
    withdrawal_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
):
    """Record that the admin sent the money externally → write withdrawal ledger entry.

    Body: { external_reference?: str, note?: str }
    """
    wd = _load(db, withdrawal_id)
    if wd.status not in (WithdrawalRequestStatusEnum.pending, WithdrawalRequestStatusEnum.approved):
        raise HTTPException(status_code=400, detail="Withdrawal cannot be settled in current state.")

    payload = (await request.json()) if (await request.body()) else {}
    wallet = db.query(Wallet).filter(Wallet.id == wd.wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=500, detail="Wallet missing.")

    try:
        entry = wallet_withdrawal(
            db, wallet, Decimal(str(wd.amount)),
            description=f"Admin-settled withdrawal — {wd.request_code}",
            metadata={
                "withdrawal_request_id": str(wd.id),
                "external_reference": payload.get("external_reference"),
                "admin_note": payload.get("note"),
            },
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    wd.status = WithdrawalRequestStatusEnum.settled
    wd.admin_user_id = admin.id if hasattr(admin, "id") else wd.admin_user_id
    wd.admin_note = (payload.get("note") or "").strip() or wd.admin_note
    wd.external_reference = (payload.get("external_reference") or "").strip() or wd.external_reference
    wd.settle_ledger_entry_id = entry.id
    wd.reviewed_at = wd.reviewed_at or datetime.utcnow()
    wd.settled_at = datetime.utcnow()
    db.commit()
    db.refresh(wd)
    return api_response(True, "Withdrawal settled.", _serialize(wd))


@router.post("/{withdrawal_id}/reject")
async def admin_reject(
    withdrawal_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
):
    """Decline the request and release held funds back to available."""
    wd = _load(db, withdrawal_id)
    if wd.status not in (WithdrawalRequestStatusEnum.pending, WithdrawalRequestStatusEnum.approved):
        raise HTTPException(status_code=400, detail="Withdrawal cannot be rejected in current state.")

    payload = (await request.json()) if (await request.body()) else {}
    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A reject reason (note) is required.")

    wallet = db.query(Wallet).filter(Wallet.id == wd.wallet_id).first()
    if wallet:
        try:
            release(
                db, wallet, Decimal(str(wd.amount)),
                description=f"Withdrawal rejected — {wd.request_code}",
                metadata={"withdrawal_request_id": str(wd.id), "admin_note": note},
            )
        except ValueError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    wd.status = WithdrawalRequestStatusEnum.rejected
    wd.admin_note = note
    wd.admin_user_id = admin.id if hasattr(admin, "id") else wd.admin_user_id
    wd.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(wd)
    return api_response(True, "Withdrawal rejected.", _serialize(wd))
