"""Wallet endpoints — view balances + ledger.

GET  /wallet                       → all wallets for current user
GET  /wallet/{currency}            → single wallet (creates if missing)
GET  /wallet/{currency}/ledger     → paginated ledger entries
GET  /wallet/{currency}/summary    → headline stats card
"""

from datetime import timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response, paginate
from models.users import User
from models.payments import Wallet, WalletLedgerEntry
from services.wallet_service import get_or_create_wallet


def _iso_utc(dt):
    """Naive datetimes in the DB are UTC — tag them so the frontend can
    convert to the viewer's local timezone."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


router = APIRouter(prefix="/wallet", tags=["wallet"])


def _serialize_wallet(w: Wallet) -> dict:
    return {
        "id": str(w.id),
        "currency_code": w.currency_code,
        "available_balance": float(w.available_balance or 0),
        "pending_balance": float(w.pending_balance or 0),
        "total_received": float(w.total_received or 0),
        "total_sent": float(w.total_sent or 0),
        "total_withdrawn": float(w.total_withdrawn or 0),
        "is_active": w.is_active,
        "updated_at": _iso_utc(w.updated_at),
    }


def _serialize_entry(e: WalletLedgerEntry) -> dict:
    return {
        "id": str(e.id),
        "transaction_id": str(e.transaction_id) if e.transaction_id else None,
        "entry_type": e.entry_type.value if e.entry_type else None,
        "amount": float(e.amount or 0),
        "balance_before": float(e.balance_before or 0),
        "balance_after": float(e.balance_after or 0),
        "description": e.description,
        "metadata": e.metadata_json or {},
        "created_at": _iso_utc(e.created_at),
    }


@router.get("")
def list_wallets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallets = db.query(Wallet).filter(Wallet.user_id == current_user.id).all()
    return api_response(
        True,
        "Wallets retrieved.",
        {"wallets": [_serialize_wallet(w) for w in wallets]},
    )


def _resolve_wallet(db: Session, user: User, key: str) -> Wallet:
    """Accept either a wallet UUID or a currency code (e.g. 'TZS')."""
    import uuid as _uuid
    try:
        wid = _uuid.UUID(str(key))
        w = (
            db.query(Wallet)
            .filter(Wallet.id == wid, Wallet.user_id == user.id)
            .first()
        )
        if w:
            return w
    except (ValueError, AttributeError):
        pass
    return get_or_create_wallet(db, user.id, key)


@router.get("/{key}")
def get_wallet(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = _resolve_wallet(db, current_user, key)
    db.commit()
    db.refresh(wallet)
    return api_response(True, "Wallet retrieved.", _serialize_wallet(wallet))


@router.get("/{key}/ledger")
def wallet_ledger(
    key: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    entry_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = _resolve_wallet(db, current_user, key)
    db.commit()

    q = (
        db.query(WalletLedgerEntry)
        .filter(WalletLedgerEntry.wallet_id == wallet.id)
        .order_by(WalletLedgerEntry.created_at.desc())
    )
    if entry_type:
        q = q.filter(WalletLedgerEntry.entry_type == entry_type)

    items, pagination = paginate(q, page=page, limit=limit)
    return api_response(
        True,
        "Ledger retrieved.",
        {
            "entries": [_serialize_entry(e) for e in items],
            "pagination": pagination,
            "wallet": _serialize_wallet(wallet),
        },
    )


@router.get("/{key}/summary")
def wallet_summary(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = _resolve_wallet(db, current_user, key)
    db.commit()
    db.refresh(wallet)
    return api_response(True, "Summary retrieved.", _serialize_wallet(wallet))

