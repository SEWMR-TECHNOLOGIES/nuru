"""Commission resolver. Reads the active CommissionSetting for a country
and returns a JSON-serialisable snapshot to be embedded into Transaction."""

from decimal import Decimal
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from models.payments import CommissionSetting


def get_active_commission(db: Session, country_code: str) -> Optional[CommissionSetting]:
    return (
        db.query(CommissionSetting)
        .filter(
            CommissionSetting.country_code == country_code.upper(),
            CommissionSetting.is_active == True,  # noqa: E712
        )
        .first()
    )


def resolve_commission_snapshot(
    db: Session, country_code: str, currency_code: str
) -> Dict[str, Any]:
    """Return the snapshot dict + Decimal amount for a transaction."""
    setting = get_active_commission(db, country_code)
    if setting is None:
        # Fail open with zero — never block a payment because admin forgot
        # to configure a commission. Audit it via the snapshot.
        return {
            "country_code": country_code,
            "currency_code": currency_code,
            "amount": "0",
            "source_id": None,
            "missing_config": True,
        }
    return {
        "country_code": setting.country_code,
        "currency_code": setting.currency_code,
        "amount": str(setting.commission_amount),
        "source_id": str(setting.id),
        "missing_config": False,
    }


def commission_amount_from_snapshot(snapshot: Dict[str, Any]) -> Decimal:
    try:
        return Decimal(str(snapshot.get("amount") or "0"))
    except Exception:
        return Decimal("0")
