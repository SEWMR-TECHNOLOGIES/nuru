"""Withdrawal request endpoints — user-side.

POST /withdrawals                  → submit a request (holds funds)
GET  /withdrawals                  → list my requests (paginated)
GET  /withdrawals/{id}             → single request details
POST /withdrawals/{id}/cancel      → cancel a still-pending request (releases hold)

Withdrawals are admin-mediated. We do NOT call any payout gateway here — the
admin moves money outside the system (or via separate tooling) and then settles
the request from the admin endpoints.
"""
from datetime import datetime
from decimal import Decimal
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response, paginate
from models.users import User
from models.payments import Wallet, PaymentProfile
from models.withdrawal_requests import WithdrawalRequest
from models.enums import WithdrawalRequestStatusEnum
from services.wallet_service import get_or_create_wallet, hold, release


router = APIRouter(prefix="/withdrawals", tags=["withdrawals"])


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
        "status": w.status.value if w.status else None,
        "admin_note": w.admin_note,
        "external_reference": w.external_reference,
        "requested_at": w.requested_at.isoformat() if w.requested_at else None,
        "reviewed_at": w.reviewed_at.isoformat() if w.reviewed_at else None,
        "settled_at": w.settled_at.isoformat() if w.settled_at else None,
    }


def _next_request_code(db: Session) -> str:
    """NRU-WD-YYYY-NNNNNN — sequential per year. Cheap counter via row count."""
    year = datetime.utcnow().year
    prefix = f"NRU-WD-{year}-"
    last = (
        db.query(WithdrawalRequest)
        .filter(WithdrawalRequest.request_code.like(f"{prefix}%"))
        .order_by(WithdrawalRequest.created_at.desc())
        .first()
    )
    next_n = 1
    if last:
        try:
            next_n = int(last.request_code.split("-")[-1]) + 1
        except Exception:
            next_n = 1
    return f"{prefix}{next_n:06d}"


@router.post("", status_code=201)
async def create_withdrawal(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a withdrawal request. Holds funds available → pending."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    currency = (payload.get("currency_code") or "").upper().strip()
    if not currency:
        raise HTTPException(status_code=400, detail="currency_code is required.")
    try:
        amount = Decimal(str(payload.get("amount") or "0"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid amount.")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0.")

    payment_profile_id = payload.get("payment_profile_id")
    profile: PaymentProfile | None = None
    if payment_profile_id:
        try:
            pid = uuid_lib.UUID(str(payment_profile_id))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payment_profile_id.")
        profile = (
            db.query(PaymentProfile)
            .filter(
                PaymentProfile.id == pid,
                PaymentProfile.user_id == current_user.id,
            )
            .first()
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Payment profile not found.")

    if profile is None:
        # Try the user's default profile
        profile = (
            db.query(PaymentProfile)
            .filter(
                PaymentProfile.user_id == current_user.id,
                PaymentProfile.is_default == True,  # noqa: E712
                PaymentProfile.is_completed == True,  # noqa: E712
            )
            .first()
        )
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="A completed payment profile is required before requesting a withdrawal.",
        )

    wallet = get_or_create_wallet(db, current_user.id, currency)
    if Decimal(str(wallet.available_balance)) < amount:
        raise HTTPException(status_code=400, detail="Insufficient available balance.")

    # Place hold first so the user can't double-spend during admin review.
    hold_entry = hold(
        db, wallet, amount,
        description=f"Withdrawal hold for pending admin approval",
        metadata={"reason": "withdrawal_request"},
    )

    wd = WithdrawalRequest(
        request_code=_next_request_code(db),
        user_id=current_user.id,
        wallet_id=wallet.id,
        payment_profile_id=profile.id,
        currency_code=currency,
        amount=amount,
        user_note=(payload.get("user_note") or None),
        payout_method=profile.method_type.value if profile.method_type else None,
        payout_provider_name=profile.network_name or profile.bank_name,
        payout_account_holder=profile.account_holder_name,
        payout_account_number=profile.phone_number or profile.account_number,
        payout_snapshot={
            "country_code": profile.country_code,
            "currency_code": profile.currency_code,
            "method_type": profile.method_type.value if profile.method_type else None,
            "provider_id": str(profile.provider_id) if profile.provider_id else None,
            "network_name": profile.network_name,
            "phone_number": profile.phone_number,
            "bank_name": profile.bank_name,
            "account_number": profile.account_number,
            "account_holder_name": profile.account_holder_name,
        },
        status=WithdrawalRequestStatusEnum.pending,
        hold_ledger_entry_id=hold_entry.id,
    )
    db.add(wd)
    db.commit()
    db.refresh(wd)

    return api_response(True, "Withdrawal request submitted.", _serialize(wd))


@router.get("")
def list_my_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(WithdrawalRequest)
        .filter(WithdrawalRequest.user_id == current_user.id)
        .order_by(WithdrawalRequest.created_at.desc())
    )
    if status:
        q = q.filter(WithdrawalRequest.status == status)
    items, pagination = paginate(q, page=page, limit=limit)
    return api_response(True, "Withdrawals retrieved.", {
        "withdrawals": [_serialize(w) for w in items],
        "pagination": pagination,
    })


@router.get("/{withdrawal_id}")
def get_withdrawal(
    withdrawal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        wid = uuid_lib.UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal_id.")
    wd = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == wid).first()
    if not wd or wd.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Withdrawal not found.")
    return api_response(True, "Withdrawal retrieved.", _serialize(wd))


@router.post("/{withdrawal_id}/cancel")
def cancel_withdrawal(
    withdrawal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        wid = uuid_lib.UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal_id.")

    wd = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == wid).first()
    if not wd or wd.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Withdrawal not found.")
    if wd.status != WithdrawalRequestStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Only pending withdrawals can be cancelled.")

    wallet = db.query(Wallet).filter(Wallet.id == wd.wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=500, detail="Wallet missing.")

    # Release the hold back to available
    release(
        db, wallet, Decimal(str(wd.amount)),
        description=f"Withdrawal cancelled by user — {wd.request_code}",
        metadata={"withdrawal_request_id": str(wd.id)},
    )
    wd.status = WithdrawalRequestStatusEnum.cancelled
    wd.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(wd)
    return api_response(True, "Withdrawal cancelled.", _serialize(wd))
