"""Admin Payments Operations — finance dashboard endpoints.

All routes mounted under /admin/payments and gated by `require_finance_admin`
(super 'admin' role inherits). They power 8 dashboard sections:

  1. summary           — KPI cards
  2. ledger            — incoming-payments table + filters
  3. ledger/{tx_id}    — full transaction detail
  4. settlements       — pending payouts queue (WithdrawalRequest)
  5. settlements/...   — actions: start-review, mark-paid, hold, reject,
                                  escalate, note, split
  6. beneficiaries/{u} — payment-profile + history
  7. reconciliation    — anomaly detection
  8. reports           — CSV / PDF download
"""

from __future__ import annotations

import io
import uuid as uuid_lib
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from core.database import get_db
from utils.helpers import api_response, paginate

from models.admin import AdminUser, AdminRoleEnum
from models.users import User, UserProfile
from models.payments import (
    Transaction, Wallet, WalletLedgerEntry, PaymentProfile,
    PaymentProvider, PaymentCallbackLog,
)
from models.withdrawal_requests import WithdrawalRequest
from models.events import Event
from models.services import UserService
from models.enums import (
    TransactionStatusEnum, WithdrawalRequestStatusEnum,
    WalletEntryTypeEnum, PaymentTargetTypeEnum,
)
from models.admin_payment_logs import AdminPaymentLog

from services import admin_reports
from services.wallet_service import withdrawal as wallet_withdrawal, release as wallet_release


router = APIRouter(prefix="/admin/payments", tags=["admin-payments-ops"])

print("[admin-payments-ops] MODULE LOADED — router registered with prefix /admin/payments", flush=True)


# ──────────────────────────────────────────────
# Auth gate — finance_admin or admin
# ──────────────────────────────────────────────

def require_finance_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    # First-line print so we can confirm the dependency actually runs.
    auth_hdr = request.headers.get("Authorization", "")
    print(
        f"[admin-payments-ops] >>> ENTER require_finance_admin path={request.url.path} "
        f"method={request.method} has_auth={bool(auth_hdr)} auth_prefix={auth_hdr[:15]!r}",
        flush=True,
    )
    try:
        from api.routes.admin import require_admin
        admin = require_admin(request, db)
    except HTTPException as e:
        print(
            f"[admin-payments-ops] require_admin raised {e.status_code}: {e.detail}",
            flush=True,
        )
        raise
    except Exception as e:
        print(f"[admin-payments-ops] require_admin EXCEPTION: {type(e).__name__}: {e}", flush=True)
        raise

    role_val = getattr(admin.role, "value", admin.role)
    print(
        f"[admin-payments-ops] resolved admin: id={admin.id} email={admin.email} "
        f"role={role_val!r} active={admin.is_active}",
        flush=True,
    )
    if admin.role not in (AdminRoleEnum.admin, AdminRoleEnum.finance_admin):
        print(
            f"[admin-payments-ops] DENIED — role {role_val!r} not in (admin, finance_admin)",
            flush=True,
        )
        raise HTTPException(status_code=403, detail=f"Finance admin role required (you are '{role_val}').")
    print(f"[admin-payments-ops] ALLOWED — {admin.email} ({role_val})", flush=True)
    return admin


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _money(v) -> float:
    if v is None:
        return 0.0
    return float(v)


def _user_brief(u: User | None) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "name": ((u.first_name or "") + " " + (u.last_name or "")).strip() or u.username,
        "username": u.username,
        "phone": u.phone,
        "email": u.email,
    }


def _serialize_tx_row(t: Transaction, payer: User | None, beneficiary: User | None,
                      target_name: str | None) -> dict:
    return {
        "id": str(t.id),
        "transaction_code": t.transaction_code,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "country_code": t.country_code,
        "currency_code": t.currency_code,
        "gross_amount": _money(t.gross_amount),
        "commission_amount": _money(t.commission_amount),
        "net_amount": _money(t.net_amount),
        "status": t.status.value if t.status else None,
        "method_type": t.method_type,
        "provider_name": t.provider_name,
        "external_reference": t.external_reference,
        "target_type": t.target_type.value if t.target_type else None,
        "target_id": str(t.target_id) if t.target_id else None,
        "target_name": target_name,
        "payment_description": t.payment_description,
        "payer": _user_brief(payer),
        "beneficiary": _user_brief(beneficiary),
    }


def _serialize_settlement(wd: WithdrawalRequest, user: User | None) -> dict:
    age_days = None
    if wd.created_at:
        age_days = max(0, (datetime.utcnow() - wd.created_at).days)
    priority = "low"
    if wd.status == WithdrawalRequestStatusEnum.pending:
        if (age_days or 0) >= 7:
            priority = "high"
        elif (age_days or 0) >= 3:
            priority = "medium"
    return {
        "id": str(wd.id),
        "request_code": wd.request_code,
        "status": wd.status.value if wd.status else None,
        "currency_code": wd.currency_code,
        "amount": _money(wd.amount),
        "user_note": wd.user_note,
        "admin_note": wd.admin_note,
        "external_reference": wd.external_reference,
        "payout_method": wd.payout_method,
        "payout_provider_name": wd.payout_provider_name,
        "payout_account_holder": wd.payout_account_holder,
        "payout_account_number": wd.payout_account_number,
        "created_at": wd.created_at.isoformat() if wd.created_at else None,
        "settled_at": wd.settled_at.isoformat() if wd.settled_at else None,
        "age_days": age_days,
        "priority": priority,
        "beneficiary": _user_brief(user),
    }


def _log(db: Session, admin: AdminUser, action: str, target_type: str,
         target_id, old_status: str | None, new_status: str | None,
         note: str | None = None, payload: dict | None = None) -> None:
    db.add(AdminPaymentLog(
        admin_user_id=admin.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        old_status=old_status,
        new_status=new_status,
        note=note,
        payload=payload,
    ))


# ──────────────────────────────────────────────
# 1. Executive summary
# ──────────────────────────────────────────────

@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    now = datetime.utcnow()
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def _sum(q):
        r = q.with_entities(
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
            func.count(Transaction.id),
        ).first()
        return {"gross": _money(r[0]), "commission": _money(r[1]),
                "net": _money(r[2]), "count": int(r[3])}

    completed_tx = db.query(Transaction).filter(
        Transaction.status.in_([TransactionStatusEnum.paid, TransactionStatusEnum.credited])
    )

    today_q = completed_tx.filter(func.date(Transaction.completed_at) == today)
    week_q = completed_tx.filter(func.date(Transaction.completed_at) >= week_start)
    month_q = completed_tx.filter(func.date(Transaction.completed_at) >= month_start)

    failed_count = db.query(func.count(Transaction.id)).filter(
        Transaction.status == TransactionStatusEnum.failed,
        func.date(Transaction.created_at) >= month_start,
    ).scalar() or 0
    refunded_count = db.query(func.count(Transaction.id)).filter(
        Transaction.status == TransactionStatusEnum.reversed,
        func.date(Transaction.created_at) >= month_start,
    ).scalar() or 0

    pending_q = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.status.in_([
            WithdrawalRequestStatusEnum.pending,
            WithdrawalRequestStatusEnum.approved,
        ])
    )
    pending_count = pending_q.count()
    pending_amount = pending_q.with_entities(
        func.coalesce(func.sum(WithdrawalRequest.amount), 0)
    ).scalar() or 0

    completed_settle_q = db.query(WithdrawalRequest).filter(
        WithdrawalRequest.status == WithdrawalRequestStatusEnum.settled,
        func.date(WithdrawalRequest.settled_at) >= month_start,
    )
    completed_settle_count = completed_settle_q.count()
    completed_settle_amount = completed_settle_q.with_entities(
        func.coalesce(func.sum(WithdrawalRequest.amount), 0)
    ).scalar() or 0

    wallet_liability = db.query(
        func.coalesce(func.sum(Wallet.available_balance + Wallet.pending_balance), 0)
    ).scalar() or 0

    # 30-day daily series for the area chart.
    series_start = today - timedelta(days=29)
    series_rows = (
        completed_tx
        .filter(func.date(Transaction.completed_at) >= series_start)
        .with_entities(
            func.date(Transaction.completed_at).label("d"),
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.coalesce(func.sum(Transaction.commission_amount), 0),
            func.coalesce(func.sum(Transaction.net_amount), 0),
        )
        .group_by("d").order_by("d").all()
    )
    by_day = {str(r[0]): {"gross": _money(r[1]), "commission": _money(r[2]), "net": _money(r[3])}
              for r in series_rows}
    series = []
    for i in range(30):
        d = series_start + timedelta(days=i)
        row = by_day.get(str(d), {"gross": 0.0, "commission": 0.0, "net": 0.0})
        series.append({"date": d.isoformat(), **row})

    # Country mix this month
    country_rows = (
        month_q
        .with_entities(
            Transaction.country_code,
            func.coalesce(func.sum(Transaction.gross_amount), 0),
            func.count(Transaction.id),
        )
        .group_by(Transaction.country_code)
        .all()
    )
    country_mix = [{"country_code": r[0], "gross": _money(r[1]), "count": int(r[2])}
                   for r in country_rows]

    # Status mix this month
    status_rows = (
        db.query(Transaction.status, func.count(Transaction.id))
        .filter(func.date(Transaction.created_at) >= month_start)
        .group_by(Transaction.status)
        .all()
    )
    status_mix = [{"status": s.value if s else "unknown", "count": int(c)} for s, c in status_rows]

    return api_response(True, "Summary retrieved.", {
        "today": _sum(today_q),
        "week": _sum(week_q),
        "month": _sum(month_q),
        "failed_count_30d": int(failed_count),
        "refunded_count_30d": int(refunded_count),
        "pending_payouts": {"count": pending_count, "amount": _money(pending_amount)},
        "completed_payouts_30d": {"count": completed_settle_count, "amount": _money(completed_settle_amount)},
        "wallet_liability": _money(wallet_liability),
        "reviews_needed": pending_count,  # alias
        "series_30d": series,
        "country_mix_month": country_mix,
        "status_mix_month": status_mix,
    })


# ──────────────────────────────────────────────
# 2. Incoming payments ledger
# ──────────────────────────────────────────────

@router.get("/ledger")
def ledger(
    status: Optional[str] = Query(None),
    country_code: Optional[str] = Query(None),
    currency_code: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    q: Optional[str] = Query(None, description="Free-text on tx code / external ref / description"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    qry = db.query(Transaction)
    if status:
        qry = qry.filter(Transaction.status == status)
    if country_code:
        qry = qry.filter(Transaction.country_code == country_code.upper())
    if currency_code:
        qry = qry.filter(Transaction.currency_code == currency_code.upper())
    if provider:
        qry = qry.filter(Transaction.provider_name.ilike(f"%{provider}%"))
    if target_type:
        qry = qry.filter(Transaction.target_type == target_type)
    if user_id:
        try:
            uid = uuid_lib.UUID(user_id)
            qry = qry.filter(or_(
                Transaction.payer_user_id == uid,
                Transaction.beneficiary_user_id == uid,
            ))
        except ValueError:
            pass
    if min_amount is not None:
        qry = qry.filter(Transaction.gross_amount >= min_amount)
    if max_amount is not None:
        qry = qry.filter(Transaction.gross_amount <= max_amount)
    if date_from:
        qry = qry.filter(func.date(Transaction.created_at) >= date_from)
    if date_to:
        qry = qry.filter(func.date(Transaction.created_at) <= date_to)
    if q:
        like = f"%{q.strip()}%"
        qry = qry.filter(or_(
            Transaction.transaction_code.ilike(like),
            Transaction.external_reference.ilike(like),
            Transaction.payment_description.ilike(like),
        ))

    qry = qry.order_by(Transaction.created_at.desc())
    items, pagination = paginate(qry, page=page, limit=limit)

    # Batch-fetch related users + targets for nice display.
    user_ids: set = set()
    event_ids: set = set()
    service_ids: set = set()
    for t in items:
        if t.payer_user_id: user_ids.add(t.payer_user_id)
        if t.beneficiary_user_id: user_ids.add(t.beneficiary_user_id)
        if t.target_id and t.target_type == PaymentTargetTypeEnum.booking:
            service_ids.add(t.target_id)
        if t.target_id and t.target_type in (
            getattr(PaymentTargetTypeEnum, "ticket", None),
            getattr(PaymentTargetTypeEnum, "event_contribution", None),
        ):
            event_ids.add(t.target_id)

    users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    events_map = {e.id: e for e in db.query(Event).filter(Event.id.in_(event_ids)).all()} if event_ids else {}
    services_map = {s.id: s for s in db.query(UserService).filter(UserService.id.in_(service_ids)).all()} if service_ids else {}

    rows = []
    for t in items:
        target_name = None
        if t.target_id in events_map:
            target_name = events_map[t.target_id].title
        elif t.target_id in services_map:
            target_name = services_map[t.target_id].title
        rows.append(_serialize_tx_row(
            t,
            users_map.get(t.payer_user_id),
            users_map.get(t.beneficiary_user_id),
            target_name,
        ))

    return api_response(True, "Ledger retrieved.", {
        "transactions": rows,
        "pagination": pagination,
    })


@router.get("/ledger/{tx_id}")
def ledger_detail(
    tx_id: str,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    try:
        uid = uuid_lib.UUID(tx_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction id.")
    t = db.query(Transaction).filter(Transaction.id == uid).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    payer = db.query(User).filter(User.id == t.payer_user_id).first() if t.payer_user_id else None
    beneficiary = db.query(User).filter(User.id == t.beneficiary_user_id).first() if t.beneficiary_user_id else None
    target_name = None
    if t.target_id:
        if t.target_type == PaymentTargetTypeEnum.booking:
            s = db.query(UserService).filter(UserService.id == t.target_id).first()
            target_name = s.title if s else None
        else:
            e = db.query(Event).filter(Event.id == t.target_id).first()
            target_name = e.name if e else None

    # Pull every callback we've persisted for this tx — both rows that were
    # successfully linked via `transaction_id` AND rows that arrived with
    # only a `checkout_request_id` matching one of this tx's attempts (which
    # is exactly how a failed callback may look before reconciliation).
    from models.payments import MobilePaymentAttempt  # local import: avoid cycle
    attempt_checkout_ids = [
        a.checkout_request_id for a in
        db.query(MobilePaymentAttempt).filter(MobilePaymentAttempt.transaction_id == t.id).all()
        if a.checkout_request_id
    ]
    cb_filter = [PaymentCallbackLog.transaction_id == t.id]
    if attempt_checkout_ids:
        cb_filter.append(PaymentCallbackLog.checkout_request_id.in_(attempt_checkout_ids))

    callback_logs = (
        db.query(PaymentCallbackLog)
        .filter(or_(*cb_filter))
        .order_by(PaymentCallbackLog.received_at.desc())
        .all()
    )

    def _cb_reason(p):
        if not isinstance(p, dict):
            return None
        return (
            p.get("ResultDesc")
            or p.get("ResultDescription")
            or p.get("ResponseDescription")
            or p.get("detail")
        )

    def _cb_result_code(p):
        if not isinstance(p, dict):
            return None
        rc = p.get("ResultCode") if p.get("ResultCode") is not None else p.get("ResponseCode")
        return str(rc) if rc is not None else None

    # The most recent non-success callback's reason (used to surface a clear
    # failure cause even when the gateway's status-query was an async ack).
    failure_from_cb = None
    for c in callback_logs:
        rc = _cb_result_code(c.payload)
        if rc and rc != "0":
            failure_from_cb = _cb_reason(c.payload)
            if failure_from_cb:
                break

    ledger_entries = (
        db.query(WalletLedgerEntry)
        .filter(WalletLedgerEntry.related_transaction_id == t.id)
        .order_by(WalletLedgerEntry.created_at.asc())
        .all()
    ) if hasattr(WalletLedgerEntry, "related_transaction_id") else []

    admin_logs = (
        db.query(AdminPaymentLog, AdminUser)
        .outerjoin(AdminUser, AdminUser.id == AdminPaymentLog.admin_user_id)
        .filter(AdminPaymentLog.target_type == "transaction", AdminPaymentLog.target_id == t.id)
        .order_by(AdminPaymentLog.created_at.desc())
        .all()
    )

    return api_response(True, "Transaction retrieved.", {
        **_serialize_tx_row(t, payer, beneficiary, target_name),
        "commission_snapshot": t.commission_snapshot,
        "api_request_payload_snapshot": t.api_request_payload_snapshot,
        "api_response_payload_snapshot": t.api_response_payload_snapshot,
        "callback_payload_snapshot": t.callback_payload_snapshot,
        "failure_reason_from_callbacks": failure_from_cb,
        "callback_logs": [
            {
                "id": str(c.id),
                "gateway": c.gateway,
                "checkout_request_id": c.checkout_request_id,
                "received_at": c.received_at.isoformat() if c.received_at else None,
                "processed": bool(c.processed),
                "processing_error": c.processing_error,
                "result_code": _cb_result_code(c.payload),
                "result_desc": _cb_reason(c.payload),
                "payload": c.payload,
            } for c in callback_logs
        ],
        "ledger_entries": [
            {
                "id": str(le.id),
                "entry_type": le.entry_type.value if le.entry_type else None,
                "amount": _money(le.amount),
                "balance_before": _money(le.balance_before),
                "balance_after": _money(le.balance_after),
                "description": le.description,
                "created_at": le.created_at.isoformat() if le.created_at else None,
            } for le in ledger_entries
        ],
        "admin_history": [
            {
                "id": str(log.id),
                "admin": (au.full_name if au else None),
                "action": log.action,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "note": log.note,
                "payload": log.payload,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            } for log, au in admin_logs
        ],
    })


# ──────────────────────────────────────────────
# 3 + 5. Pending settlements queue + actions
# ──────────────────────────────────────────────

@router.get("/settlements")
def settlements(
    status: Optional[str] = Query("pending"),
    currency_code: Optional[str] = Query(None),
    priority: Optional[str] = Query(None, description="low|medium|high"),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    qry = db.query(WithdrawalRequest)
    if status and status != "all":
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        try:
            qry = qry.filter(WithdrawalRequest.status.in_(
                [WithdrawalRequestStatusEnum(s) for s in statuses]
            ))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status value.")
    if currency_code:
        qry = qry.filter(WithdrawalRequest.currency_code == currency_code.upper())
    if q:
        like = f"%{q.strip()}%"
        qry = qry.filter(or_(
            WithdrawalRequest.request_code.ilike(like),
            WithdrawalRequest.payout_account_number.ilike(like),
            WithdrawalRequest.payout_account_holder.ilike(like),
        ))
    qry = qry.order_by(WithdrawalRequest.created_at.asc())  # oldest first

    items, pagination = paginate(qry, page=page, limit=limit)
    user_ids = {wd.user_id for wd in items if wd.user_id}
    user_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    rows = [_serialize_settlement(wd, user_map.get(wd.user_id)) for wd in items]
    if priority:
        rows = [r for r in rows if r["priority"] == priority]

    return api_response(True, "Settlements retrieved.", {
        "settlements": rows,
        "pagination": pagination,
    })


def _load_settlement(db: Session, sid: str) -> WithdrawalRequest:
    try:
        uid = uuid_lib.UUID(sid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid settlement id.")
    wd = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == uid).first()
    if not wd:
        raise HTTPException(status_code=404, detail="Settlement not found.")
    return wd


@router.post("/settlements/{sid}/start-review")
async def settlement_start_review(
    sid: str, request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    wd = _load_settlement(db, sid)
    if wd.status != WithdrawalRequestStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Only pending settlements can enter review.")
    payload = (await request.json()) if (await request.body()) else {}
    old = wd.status.value
    wd.status = WithdrawalRequestStatusEnum.approved   # 'approved' = under review here
    wd.admin_user_id = admin.id
    wd.reviewed_at = datetime.utcnow()
    wd.admin_note = (payload.get("note") or "").strip() or wd.admin_note
    _log(db, admin, "start_review", "withdrawal_request", wd.id, old, wd.status.value,
         note=payload.get("note"))
    db.commit(); db.refresh(wd)
    return api_response(True, "Settlement under review.", _serialize_settlement(wd, None))


@router.post("/settlements/{sid}/mark-paid")
async def settlement_mark_paid(
    sid: str, request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    """Required body: { external_reference, channel, note? }"""
    wd = _load_settlement(db, sid)
    if wd.status not in (WithdrawalRequestStatusEnum.pending, WithdrawalRequestStatusEnum.approved):
        raise HTTPException(status_code=400, detail="Settlement cannot be marked paid in current state.")
    payload = (await request.json()) if (await request.body()) else {}
    external_reference = (payload.get("external_reference") or "").strip()
    channel = (payload.get("channel") or "").strip()
    note = (payload.get("note") or "").strip() or None
    if not external_reference:
        raise HTTPException(status_code=400, detail="external_reference is required.")
    if not channel:
        raise HTTPException(status_code=400, detail="channel is required.")

    wallet = db.query(Wallet).filter(Wallet.id == wd.wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=500, detail="Wallet missing.")
    try:
        entry = wallet_withdrawal(
            db, wallet, Decimal(str(wd.amount)),
            description=f"Admin-settled — {wd.request_code}",
            metadata={
                "withdrawal_request_id": str(wd.id),
                "external_reference": external_reference,
                "channel": channel,
                "admin_note": note,
            },
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    old = wd.status.value
    wd.status = WithdrawalRequestStatusEnum.settled
    wd.admin_user_id = admin.id
    wd.external_reference = external_reference
    wd.admin_note = note or wd.admin_note
    wd.settle_ledger_entry_id = entry.id
    wd.settled_at = datetime.utcnow()
    _log(db, admin, "mark_paid", "withdrawal_request", wd.id, old, "settled",
         note=note, payload={"external_reference": external_reference, "channel": channel})
    db.commit(); db.refresh(wd)
    return api_response(True, "Settlement marked paid.", _serialize_settlement(wd, None))


@router.post("/settlements/{sid}/hold")
async def settlement_hold(
    sid: str, request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    wd = _load_settlement(db, sid)
    payload = (await request.json()) if (await request.body()) else {}
    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A hold reason (note) is required.")
    old = wd.status.value
    wd.admin_note = note
    wd.admin_user_id = admin.id
    _log(db, admin, "hold", "withdrawal_request", wd.id, old, old, note=note)
    db.commit(); db.refresh(wd)
    return api_response(True, "Settlement placed on hold.", _serialize_settlement(wd, None))


@router.post("/settlements/{sid}/reject")
async def settlement_reject(
    sid: str, request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    wd = _load_settlement(db, sid)
    if wd.status not in (WithdrawalRequestStatusEnum.pending, WithdrawalRequestStatusEnum.approved):
        raise HTTPException(status_code=400, detail="Settlement cannot be rejected in current state.")
    payload = (await request.json()) if (await request.body()) else {}
    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A reject reason is required.")
    wallet = db.query(Wallet).filter(Wallet.id == wd.wallet_id).first()
    if wallet:
        try:
            wallet_release(db, wallet, Decimal(str(wd.amount)),
                           description=f"Settlement rejected — {wd.request_code}",
                           metadata={"withdrawal_request_id": str(wd.id), "admin_note": note})
        except ValueError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
    old = wd.status.value
    wd.status = WithdrawalRequestStatusEnum.rejected
    wd.admin_note = note
    wd.admin_user_id = admin.id
    wd.reviewed_at = datetime.utcnow()
    _log(db, admin, "reject", "withdrawal_request", wd.id, old, "rejected", note=note)
    db.commit(); db.refresh(wd)
    return api_response(True, "Settlement rejected.", _serialize_settlement(wd, None))


@router.post("/settlements/{sid}/escalate")
async def settlement_escalate(
    sid: str, request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    wd = _load_settlement(db, sid)
    payload = (await request.json()) if (await request.body()) else {}
    note = (payload.get("note") or "").strip() or "Escalated for review"
    _log(db, admin, "escalate", "withdrawal_request", wd.id, wd.status.value, wd.status.value, note=note)
    wd.admin_note = note
    db.commit(); db.refresh(wd)
    return api_response(True, "Settlement escalated.", _serialize_settlement(wd, None))


@router.post("/settlements/{sid}/note")
async def settlement_add_note(
    sid: str, request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    wd = _load_settlement(db, sid)
    payload = (await request.json()) if (await request.body()) else {}
    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="Note text required.")
    _log(db, admin, "note", "withdrawal_request", wd.id, wd.status.value, wd.status.value, note=note)
    db.commit()
    return api_response(True, "Note added.", {"id": sid})


@router.get("/settlements/{sid}/history")
def settlement_history(
    sid: str,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    try:
        uid = uuid_lib.UUID(sid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id.")
    rows = (
        db.query(AdminPaymentLog, AdminUser)
        .outerjoin(AdminUser, AdminUser.id == AdminPaymentLog.admin_user_id)
        .filter(AdminPaymentLog.target_type == "withdrawal_request", AdminPaymentLog.target_id == uid)
        .order_by(AdminPaymentLog.created_at.desc())
        .all()
    )
    return api_response(True, "History retrieved.", {
        "history": [
            {
                "id": str(log.id),
                "admin": au.full_name if au else None,
                "action": log.action,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "note": log.note,
                "payload": log.payload,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            } for log, au in rows
        ],
    })


# ──────────────────────────────────────────────
# 4. Beneficiary view
# ──────────────────────────────────────────────

@router.get("/beneficiaries/{user_id}")
def beneficiary(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    try:
        uid = uuid_lib.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user id.")
    u = db.query(User).filter(User.id == uid).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    profile = db.query(UserProfile).filter(UserProfile.user_id == uid).first()
    pps = db.query(PaymentProfile).filter(PaymentProfile.user_id == uid).all()
    wallets = db.query(Wallet).filter(Wallet.user_id == uid).all()
    last_payouts = (
        db.query(WithdrawalRequest)
        .filter(WithdrawalRequest.user_id == uid)
        .order_by(WithdrawalRequest.created_at.desc())
        .limit(20).all()
    )

    return api_response(True, "Beneficiary retrieved.", {
        "user": {
            **(_user_brief(u) or {}),
            "country_code": getattr(profile, "country_code", None) if profile else None,
            "currency_code": getattr(profile, "currency_code", None) if profile else None,
        },
        "payment_profiles": [
            {
                "id": str(p.id),
                "country_code": p.country_code,
                "currency_code": p.currency_code,
                "method_type": p.method_type.value if p.method_type else None,
                "network_name": p.network_name,
                "phone_number": p.phone_number,
                "bank_name": p.bank_name,
                "account_number": p.account_number,
                "account_holder_name": p.account_holder_name,
                "is_default": p.is_default,
                "is_verified": p.is_verified,
                "is_completed": p.is_completed,
            } for p in pps
        ],
        "wallets": [
            {
                "currency_code": w.currency_code,
                "available_balance": _money(w.available_balance),
                "pending_balance": _money(w.pending_balance),
            } for w in wallets
        ],
        "last_payouts": [_serialize_settlement(wd, u) for wd in last_payouts],
        "failed_payouts": [
            _serialize_settlement(wd, u) for wd in last_payouts
            if wd.status == WithdrawalRequestStatusEnum.rejected
        ],
    })


# ──────────────────────────────────────────────
# 7. Reconciliation
# ──────────────────────────────────────────────

@router.get("/reconciliation")
def reconciliation(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_finance_admin),
):
    cutoff = datetime.utcnow() - timedelta(days=30)

    # Duplicates: same payer + same gross_amount within 5 minutes, both completed.
    dup_rows = db.execute(  # raw fallback for window function; safe because no user input
        # Use SA core — same payer + amount + ±5 minutes
        # We implement with a self-join via SQL for clarity.
        # NOTE: This is a heuristic, not a hard rule.
        # SQL sourced internally.
        # ----
        # language=sql
        """
        SELECT a.id, a.transaction_code, a.payer_user_id, a.gross_amount,
               a.currency_code, a.created_at, b.transaction_code AS dup_code,
               b.created_at AS dup_created_at
          FROM transactions a
          JOIN transactions b
            ON a.payer_user_id = b.payer_user_id
           AND a.gross_amount = b.gross_amount
           AND a.currency_code = b.currency_code
           AND a.id < b.id
           AND ABS(EXTRACT(EPOCH FROM (a.created_at - b.created_at))) <= 300
         WHERE a.created_at >= :cutoff
           AND a.status IN ('paid','credited')
           AND b.status IN ('paid','credited')
         ORDER BY a.created_at DESC
         LIMIT 100
        """,
        {"cutoff": cutoff},
    ).fetchall()

    duplicates = [{
        "transaction_code": r[1], "payer_user_id": str(r[2]) if r[2] else None,
        "amount": _money(r[3]), "currency_code": r[4],
        "created_at": r[5].isoformat() if r[5] else None,
        "duplicate_code": r[6], "duplicate_created_at": r[7].isoformat() if r[7] else None,
    } for r in dup_rows]

    # Uncredited: paid but not credited > 24h.
    uncredited_rows = (
        db.query(Transaction)
        .filter(
            Transaction.status == TransactionStatusEnum.paid,
            Transaction.completed_at.isnot(None),
            Transaction.completed_at <= datetime.utcnow() - timedelta(hours=24),
        )
        .order_by(Transaction.completed_at.asc())
        .limit(100).all()
    )
    uncredited = [{
        "transaction_code": t.transaction_code,
        "amount": _money(t.gross_amount),
        "currency_code": t.currency_code,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "id": str(t.id),
    } for t in uncredited_rows]

    # Missing external reference on settled withdrawals.
    missing_refs = (
        db.query(WithdrawalRequest)
        .filter(WithdrawalRequest.status == WithdrawalRequestStatusEnum.settled,
                or_(WithdrawalRequest.external_reference.is_(None),
                    WithdrawalRequest.external_reference == ""))
        .order_by(WithdrawalRequest.settled_at.desc())
        .limit(50).all()
    )
    missing = [{"id": str(w.id), "request_code": w.request_code,
                "amount": _money(w.amount), "currency_code": w.currency_code,
                "settled_at": w.settled_at.isoformat() if w.settled_at else None}
               for w in missing_refs]

    # Failed callbacks
    failed_callbacks: list[dict] = []
    if hasattr(PaymentCallbackLog, "status"):
        fcb = (
            db.query(PaymentCallbackLog)
            .filter(PaymentCallbackLog.status != "ok")
            .order_by(PaymentCallbackLog.received_at.desc())
            .limit(50).all()
        )
        failed_callbacks = [{
            "id": str(c.id),
            "status": getattr(c, "status", None),
            "created_at": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
        } for c in fcb]

    return api_response(True, "Reconciliation snapshot.", {
        "duplicates": duplicates,
        "uncredited": uncredited,
        "missing_external_references": missing,
        "failed_callbacks": failed_callbacks,
    })


# ──────────────────────────────────────────────
# 8. Reports
# ──────────────────────────────────────────────

@router.get("/reports")
def report(
    type: str = Query(..., description="Report key — see /reports/types"),
    format: str = Query("csv", regex="^(csv|pdf|json)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_finance_admin),
):
    if type not in admin_reports.REPORTS:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {type}")
    title, builder = admin_reports.REPORTS[type]

    today = datetime.utcnow().date()
    end = date_to or today
    start = date_from or (end - timedelta(days=29))

    headers, rows = builder(db, start, end)

    # JSON preview — used by the Reports page to render the in-app preview
    # (matches the Contributions / Expenses report flow).
    if format == "json":
        # Convert rows (list of tuples) into list of dicts keyed by header.
        dict_rows = [
            {h: (r[i] if i < len(r) else None) for i, h in enumerate(headers)}
            for r in rows
        ]
        # Generic columns descriptor — frontend formats based on key.
        columns = [{"key": h, "label": h.replace("_", " ").title()} for h in headers]
        # Lightweight summary cards: total rows + date span.
        summary = [
            {"label": "Rows", "value": str(len(dict_rows))},
            {"label": "From", "value": start.isoformat()},
            {"label": "To",   "value": end.isoformat()},
        ]
        return api_response(True, "Report generated.", {
            "title": title,
            "rows": dict_rows,
            "columns": columns,
            "summary": summary,
            "footer_note": f"Generated by {admin.full_name} · {datetime.utcnow().isoformat()}Z",
        })

    if format == "csv":
        body = admin_reports.to_csv(headers, rows)
        filename = f"nuru-{type}-{start.isoformat()}-{end.isoformat()}.csv"
        return StreamingResponse(
            io.BytesIO(body),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
        )

    body = admin_reports.to_pdf(title, headers, rows, start, end, generated_by=admin.full_name)
    filename = f"nuru-{type}-{start.isoformat()}-{end.isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(body),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


@router.get("/reports/types")
def report_types(_admin: AdminUser = Depends(require_finance_admin)):
    return api_response(True, "Report types.", {
        "types": [{"key": k, "label": v[0]} for k, v in admin_reports.REPORTS.items()],
    })
