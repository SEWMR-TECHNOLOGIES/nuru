"""Transaction code generator + creation helper.

Codes look like:  NRU-TXN-2026-7F3A91
Short enough to share over SMS, long enough to avoid collisions
(~16M combinations per year).
"""

from datetime import datetime
import secrets
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID

from sqlalchemy.orm import Session

from models.payments import Transaction
from models.enums import PaymentTargetTypeEnum, TransactionStatusEnum
from services.commission_service import (
    resolve_commission_snapshot,
    commission_amount_from_snapshot,
)


_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I, O, 0, 1


def generate_transaction_code() -> str:
    suffix = "".join(secrets.choice(_ALPHABET) for _ in range(6))
    return f"NRU-TXN-{datetime.utcnow().year}-{suffix}"


def create_transaction(
    db: Session,
    *,
    payer_user_id: Optional[UUID],
    beneficiary_user_id: Optional[UUID],
    target_type: PaymentTargetTypeEnum,
    target_id: Optional[UUID],
    country_code: str,
    currency_code: str,
    gross_amount: Decimal,
    method_type: str,
    payment_description: str,
    provider_id: Optional[UUID] = None,
    provider_name: Optional[str] = None,
    payment_channel: Optional[str] = None,
    internal_reference: Optional[str] = None,
    api_request_payload_snapshot: Optional[Dict[str, Any]] = None,
) -> Transaction:
    """Build + persist a Transaction with a fresh commission snapshot.

    Caller is responsible for the surrounding db.commit().
    """
    snapshot = resolve_commission_snapshot(db, country_code, currency_code)
    commission = commission_amount_from_snapshot(snapshot)
    if commission < 0:
        commission = Decimal("0")

    # Commission policy:
    #   - Wallet top-ups: NO commission charged (the user is funding their own
    #     wallet — they should receive the full amount they pay).
    #   - Everything else (tickets, contributions, bookings, payouts):
    #     commission is added ON TOP of the requested amount. The buyer pays
    #     gross + commission so the beneficiary still receives the full
    #     `gross_amount` they asked for. `gross_amount` therefore becomes the
    #     total charged, and `net_amount` is what the beneficiary receives.
    if target_type == PaymentTargetTypeEnum.wallet_topup:
        commission = Decimal("0")
        total_charged = gross_amount
        net = gross_amount
    else:
        total_charged = gross_amount + commission
        net = gross_amount  # beneficiary receives the original requested amount

    # Persist the *total charged* as gross_amount so receipts, ledgers and
    # gateway calls all line up with what the customer actually pays.
    gross_amount = total_charged

    # Ensure unique transaction_code (extremely low collision risk).
    for _ in range(5):
        code = generate_transaction_code()
        if not db.query(Transaction.id).filter(Transaction.transaction_code == code).first():
            break
    else:  # pragma: no cover
        code = generate_transaction_code()

    tx = Transaction(
        transaction_code=code,
        payer_user_id=payer_user_id,
        beneficiary_user_id=beneficiary_user_id,
        target_type=target_type,
        target_id=target_id,
        country_code=country_code.upper(),
        currency_code=currency_code.upper(),
        gross_amount=gross_amount,
        commission_amount=commission,
        net_amount=net,
        commission_snapshot=snapshot,
        method_type=method_type,
        provider_id=provider_id,
        provider_name=provider_name,
        payment_channel=payment_channel,
        internal_reference=internal_reference,
        payment_description=payment_description,
        status=TransactionStatusEnum.pending,
        api_request_payload_snapshot=api_request_payload_snapshot,
    )
    db.add(tx)
    db.flush()
    return tx
