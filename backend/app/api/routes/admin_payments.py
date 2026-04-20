"""Admin endpoints for managing providers, commissions, transactions.

Mounted under /admin/payments — guarded by `require_admin` from admin.py.

GET    /admin/payments/providers
POST   /admin/payments/providers
PATCH  /admin/payments/providers/{id}
DELETE /admin/payments/providers/{id}

GET    /admin/payments/commissions
POST   /admin/payments/commissions          (creates new + deactivates prior active for same country)
PATCH  /admin/payments/commissions/{id}

GET    /admin/payments/transactions          (filter by status, country, dates)
GET    /admin/payments/transactions/{id}
POST   /admin/payments/transactions/{id}/mark-settled   (manual settlement)
GET    /admin/payments/callback-logs
"""

import uuid as uuid_lib
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from core.database import get_db
from utils.helpers import api_response, paginate
from api.routes.admin import require_admin
from models.payments import (
    PaymentProvider, CommissionSetting, Transaction, PaymentCallbackLog,
)
from models.enums import (
    PaymentProviderTypeEnum, TransactionStatusEnum,
)


router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])


# ──────────────────────────────────────────────
# Providers
# ──────────────────────────────────────────────

def _serialize_provider(p: PaymentProvider) -> dict:
    return {
        "id": str(p.id),
        "country_code": p.country_code,
        "currency_code": p.currency_code,
        "provider_type": p.provider_type.value if p.provider_type else None,
        "name": p.name,
        "code": p.code,
        "gateway_code": p.gateway_code,
        "logo_url": p.logo_url,
        "is_collection_enabled": p.is_collection_enabled,
        "is_payout_enabled": p.is_payout_enabled,
        "is_active": p.is_active,
        "display_order": p.display_order,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/providers")
def admin_list_providers(
    country_code: str | None = Query(None),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    q = db.query(PaymentProvider)
    if country_code:
        q = q.filter(PaymentProvider.country_code == country_code.upper())
    rows = q.order_by(PaymentProvider.country_code, PaymentProvider.display_order).all()
    return api_response(True, "Providers retrieved.", [_serialize_provider(p) for p in rows])


@router.post("/providers", status_code=201)
async def admin_create_provider(
    request: Request,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    payload = await request.json()
    required = ["country_code", "currency_code", "provider_type", "name", "code"]
    for f in required:
        if not payload.get(f):
            raise HTTPException(status_code=400, detail=f"{f} is required.")
    try:
        ptype = PaymentProviderTypeEnum(payload["provider_type"])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider_type.")

    p = PaymentProvider(
        country_code=payload["country_code"].upper(),
        currency_code=payload["currency_code"].upper(),
        provider_type=ptype,
        name=payload["name"].strip(),
        code=payload["code"].strip(),
        gateway_code=(payload.get("gateway_code") or None),
        logo_url=payload.get("logo_url"),
        is_collection_enabled=bool(payload.get("is_collection_enabled", True)),
        is_payout_enabled=bool(payload.get("is_payout_enabled", True)),
        is_active=bool(payload.get("is_active", True)),
        display_order=int(payload.get("display_order") or 0),
        metadata_json=payload.get("metadata_json"),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return api_response(True, "Provider created.", _serialize_provider(p))


@router.patch("/providers/{provider_id}")
async def admin_update_provider(
    provider_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        pid = uuid_lib.UUID(provider_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider_id.")
    p = db.query(PaymentProvider).filter(PaymentProvider.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found.")
    payload = await request.json()
    for f in (
        "name", "code", "gateway_code", "logo_url",
        "is_collection_enabled", "is_payout_enabled", "is_active",
        "display_order", "metadata_json",
    ):
        if f in payload:
            setattr(p, f, payload[f])
    db.commit()
    db.refresh(p)
    return api_response(True, "Provider updated.", _serialize_provider(p))


@router.delete("/providers/{provider_id}")
def admin_delete_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        pid = uuid_lib.UUID(provider_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid provider_id.")
    p = db.query(PaymentProvider).filter(PaymentProvider.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found.")
    # Soft-disable rather than hard delete to preserve historical references.
    p.is_active = False
    db.commit()
    return api_response(True, "Provider deactivated.", _serialize_provider(p))


# ──────────────────────────────────────────────
# Commissions
# ──────────────────────────────────────────────

def _serialize_commission(c: CommissionSetting) -> dict:
    return {
        "id": str(c.id),
        "country_code": c.country_code,
        "currency_code": c.currency_code,
        "commission_amount": float(c.commission_amount or 0),
        "is_active": c.is_active,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/commissions")
def admin_list_commissions(
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    rows = (
        db.query(CommissionSetting)
        .order_by(CommissionSetting.country_code, CommissionSetting.is_active.desc(),
                  CommissionSetting.created_at.desc())
        .all()
    )
    return api_response(True, "Commissions retrieved.", [_serialize_commission(c) for c in rows])


@router.post("/commissions", status_code=201)
async def admin_create_commission(
    request: Request,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    payload = await request.json()
    cc = (payload.get("country_code") or "").upper().strip()
    cur = (payload.get("currency_code") or "").upper().strip()
    if not cc or not cur:
        raise HTTPException(status_code=400, detail="country_code and currency_code are required.")
    try:
        amount = Decimal(str(payload.get("commission_amount") or "0"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid commission_amount.")
    if amount < 0:
        raise HTTPException(status_code=400, detail="commission_amount must be ≥ 0.")

    # Deactivate any prior active commission for this country.
    db.query(CommissionSetting).filter(
        CommissionSetting.country_code == cc,
        CommissionSetting.is_active == True,  # noqa: E712
    ).update({"is_active": False, "updated_at": datetime.utcnow()})

    new = CommissionSetting(
        country_code=cc,
        currency_code=cur,
        commission_amount=amount,
        is_active=True,
        notes=(payload.get("notes") or None),
    )
    db.add(new)
    db.commit()
    db.refresh(new)
    return api_response(True, "Commission set.", _serialize_commission(new))


@router.patch("/commissions/{commission_id}")
async def admin_update_commission(
    commission_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        cid = uuid_lib.UUID(commission_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid commission_id.")
    c = db.query(CommissionSetting).filter(CommissionSetting.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found.")
    payload = await request.json()
    if "is_active" in payload and payload["is_active"]:
        # Activating one → deactivate other actives for same country
        db.query(CommissionSetting).filter(
            CommissionSetting.country_code == c.country_code,
            CommissionSetting.id != c.id,
            CommissionSetting.is_active == True,  # noqa: E712
        ).update({"is_active": False, "updated_at": datetime.utcnow()})
    for f in ("commission_amount", "is_active", "notes"):
        if f in payload:
            setattr(c, f, payload[f])
    db.commit()
    db.refresh(c)
    return api_response(True, "Commission updated.", _serialize_commission(c))


# ──────────────────────────────────────────────
# Transactions (admin view)
# ──────────────────────────────────────────────

def _serialize_tx_admin(t: Transaction) -> dict:
    return {
        "id": str(t.id),
        "transaction_code": t.transaction_code,
        "payer_user_id": str(t.payer_user_id) if t.payer_user_id else None,
        "beneficiary_user_id": str(t.beneficiary_user_id) if t.beneficiary_user_id else None,
        "target_type": t.target_type.value if t.target_type else None,
        "target_id": str(t.target_id) if t.target_id else None,
        "country_code": t.country_code,
        "currency_code": t.currency_code,
        "gross_amount": float(t.gross_amount or 0),
        "commission_amount": float(t.commission_amount or 0),
        "net_amount": float(t.net_amount or 0),
        "method_type": t.method_type,
        "provider_name": t.provider_name,
        "payment_channel": t.payment_channel,
        "external_reference": t.external_reference,
        "internal_reference": t.internal_reference,
        "payment_description": t.payment_description,
        "status": t.status.value if t.status else None,
        "failure_reason": t.failure_reason,
        "initiated_at": t.initiated_at.isoformat() if t.initiated_at else None,
        "confirmed_at": t.confirmed_at.isoformat() if t.confirmed_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }


@router.get("/transactions")
def admin_list_transactions(
    status: str | None = Query(None),
    country_code: str | None = Query(None),
    target_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    q = db.query(Transaction)
    if status:
        q = q.filter(Transaction.status == status)
    if country_code:
        q = q.filter(Transaction.country_code == country_code.upper())
    if target_type:
        q = q.filter(Transaction.target_type == target_type)
    q = q.order_by(Transaction.created_at.desc())
    items, pagination = paginate(q, page=page, limit=limit)
    return api_response(True, "Transactions retrieved.", {
        "transactions": [_serialize_tx_admin(t) for t in items],
        "pagination": pagination,
    })


@router.get("/transactions/{transaction_id}")
def admin_get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        tid = uuid_lib.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction_id.")
    t = db.query(Transaction).filter(Transaction.id == tid).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    data = _serialize_tx_admin(t)
    data["commission_snapshot"] = t.commission_snapshot
    data["api_request_payload_snapshot"] = t.api_request_payload_snapshot
    data["api_response_payload_snapshot"] = t.api_response_payload_snapshot
    data["callback_payload_snapshot"] = t.callback_payload_snapshot
    return api_response(True, "Transaction retrieved.", data)


@router.post("/transactions/{transaction_id}/mark-settled")
async def admin_mark_settled(
    transaction_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    try:
        tid = uuid_lib.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction_id.")
    t = db.query(Transaction).filter(Transaction.id == tid).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    payload = await request.json() if (await request.body()) else {}
    note = (payload.get("note") or "").strip() or None

    now = datetime.utcnow()
    # Only credit the wallet if not already credited (idempotent).
    if t.status != TransactionStatusEnum.credited:
        # Lazy imports avoid a circular dependency with payments routes.
        from api.routes.payments import (
            _try_credit_beneficiary, _sync_target_after_payment, _notify_payment_received,
        )
        t.status = TransactionStatusEnum.paid
        t.confirmed_at = t.confirmed_at or now
        await _try_credit_beneficiary(db, t)
        _sync_target_after_payment(db, t)
        t.status = TransactionStatusEnum.credited
        t.completed_at = now
        _notify_payment_received(db, t)
    if note:
        t.failure_reason = None
        t.payment_description = f"{t.payment_description} | admin-note: {note}"
    db.commit()
    db.refresh(t)
    return api_response(True, "Transaction marked settled.", _serialize_tx_admin(t))


# ──────────────────────────────────────────────
# Callback logs
# ──────────────────────────────────────────────

@router.get("/callback-logs")
def admin_callback_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    q = db.query(PaymentCallbackLog).order_by(PaymentCallbackLog.received_at.desc())
    items, pagination = paginate(q, page=page, limit=limit)
    return api_response(True, "Callback logs retrieved.", {
        "logs": [
            {
                "id": str(l.id),
                "gateway": l.gateway,
                "checkout_request_id": l.checkout_request_id,
                "transaction_id": str(l.transaction_id) if l.transaction_id else None,
                "processed": l.processed,
                "processing_error": l.processing_error,
                "received_at": l.received_at.isoformat() if l.received_at else None,
                "payload": l.payload,
            }
            for l in items
        ],
        "pagination": pagination,
    })
