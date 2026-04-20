"""Beneficiary payout profile endpoints.

GET    /payment-profiles                 → list current user's profiles
POST   /payment-profiles                 → create
PATCH  /payment-profiles/{id}            → update
DELETE /payment-profiles/{id}            → soft? (we hard-delete; rare)
POST   /payment-profiles/{id}/default    → mark as default
GET    /payment-profiles/required-status → does this user have a usable default?
"""

import re
import uuid as uuid_lib
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response
from models.users import User
from models.payments import PaymentProfile, PaymentProvider
from models.enums import PayoutMethodTypeEnum


router = APIRouter(prefix="/payment-profiles", tags=["payment-profiles"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

_PHONE_RE = re.compile(r"^\d{10,15}$")


def _normalize_phone(raw: str, country_code: str) -> str:
    """Force international format. Accepts 0XXXXXXXXX, +CCCXXXX, or full intl."""
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    cc = (country_code or "").upper()
    if cc == "TZ":
        if digits.startswith("0") and len(digits) == 10:
            digits = "255" + digits[1:]
        elif digits.startswith("7") or digits.startswith("6"):
            digits = "255" + digits
    elif cc == "KE":
        if digits.startswith("0") and len(digits) == 10:
            digits = "254" + digits[1:]
        elif digits.startswith("7") or digits.startswith("1"):
            digits = "254" + digits
    return digits


def _serialize(p: PaymentProfile) -> dict:
    return {
        "id": str(p.id),
        "country_code": p.country_code,
        "currency_code": p.currency_code,
        "method_type": p.method_type.value if p.method_type else None,
        "provider_id": str(p.provider_id) if p.provider_id else None,
        "network_name": p.network_name,
        "phone_number": p.phone_number,
        "bank_name": p.bank_name,
        "account_number": p.account_number,
        "account_holder_name": p.account_holder_name,
        "is_completed": p.is_completed,
        "is_verified": p.is_verified,
        "is_default": p.is_default,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@router.get("")
def list_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(PaymentProfile)
        .filter(PaymentProfile.user_id == current_user.id)
        .order_by(PaymentProfile.is_default.desc(), PaymentProfile.created_at.desc())
        .all()
    )
    return api_response(True, "Profiles retrieved.", [_serialize(p) for p in rows])


@router.get("/required-status")
def required_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Frontend gate — fast yes/no for "can this user receive money?" """
    profile = (
        db.query(PaymentProfile)
        .filter(
            PaymentProfile.user_id == current_user.id,
            PaymentProfile.is_default == True,  # noqa: E712
            PaymentProfile.is_completed == True,  # noqa: E712
        )
        .first()
    )
    return api_response(True, "Status retrieved.", {
        "has_payout_profile": profile is not None,
        "profile": _serialize(profile) if profile else None,
    })


@router.post("", status_code=201)
async def create_profile(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    country_code = (payload.get("country_code") or "").upper().strip()
    currency_code = (payload.get("currency_code") or "").upper().strip()
    method_raw = (payload.get("method_type") or "").strip()
    account_holder_name = (payload.get("account_holder_name") or "").strip()
    set_default = bool(payload.get("is_default", True))

    if not country_code or not currency_code:
        raise HTTPException(status_code=400, detail="country_code and currency_code are required.")
    if not account_holder_name:
        raise HTTPException(status_code=400, detail="account_holder_name is required.")

    try:
        method = PayoutMethodTypeEnum(method_raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="method_type must be 'mobile_money' or 'bank'.")

    provider_id = payload.get("provider_id")
    provider = None
    if provider_id:
        try:
            provider = (
                db.query(PaymentProvider)
                .filter(PaymentProvider.id == uuid_lib.UUID(str(provider_id)))
                .first()
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid provider_id.")
        if not provider or not provider.is_active or not provider.is_payout_enabled:
            raise HTTPException(status_code=400, detail="Provider not available for payouts.")

    network_name = (payload.get("network_name") or (provider.name if provider else "")).strip() or None
    bank_name = (payload.get("bank_name") or (provider.name if provider else "")).strip() or None
    phone_number = _normalize_phone(payload.get("phone_number") or "", country_code) or None
    account_number = (payload.get("account_number") or "").strip() or None

    if method == PayoutMethodTypeEnum.mobile_money:
        if not phone_number or not _PHONE_RE.match(phone_number):
            raise HTTPException(status_code=400, detail="Valid phone_number required for mobile money.")
        bank_name = None
        account_number = None
    else:
        if not bank_name or not account_number:
            raise HTTPException(status_code=400, detail="bank_name and account_number required for bank.")
        network_name = None
        # phone optional for bank profiles

    if set_default:
        # Clear current default
        db.query(PaymentProfile).filter(
            PaymentProfile.user_id == current_user.id,
            PaymentProfile.is_default == True,  # noqa: E712
        ).update({"is_default": False})

    profile = PaymentProfile(
        user_id=current_user.id,
        country_code=country_code,
        currency_code=currency_code,
        method_type=method,
        provider_id=provider.id if provider else None,
        network_name=network_name,
        phone_number=phone_number,
        bank_name=bank_name,
        account_number=account_number,
        account_holder_name=account_holder_name,
        is_completed=True,
        is_default=set_default,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return api_response(True, "Payout profile created.", _serialize(profile))


@router.patch("/{profile_id}")
async def update_profile(
    profile_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid_lib.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile_id.")
    profile = (
        db.query(PaymentProfile)
        .filter(PaymentProfile.id == pid, PaymentProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    payload = await request.json()

    if "phone_number" in payload:
        profile.phone_number = _normalize_phone(payload["phone_number"], profile.country_code) or None
    for f in ("network_name", "bank_name", "account_number", "account_holder_name"):
        if f in payload:
            setattr(profile, f, (payload[f] or "").strip() or None)

    db.commit()
    db.refresh(profile)
    return api_response(True, "Profile updated.", _serialize(profile))


@router.post("/{profile_id}/default")
def make_default(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid_lib.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile_id.")
    profile = (
        db.query(PaymentProfile)
        .filter(PaymentProfile.id == pid, PaymentProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    db.query(PaymentProfile).filter(
        PaymentProfile.user_id == current_user.id,
        PaymentProfile.is_default == True,  # noqa: E712
    ).update({"is_default": False})
    profile.is_default = True
    db.commit()
    db.refresh(profile)
    return api_response(True, "Default profile updated.", _serialize(profile))


@router.delete("/{profile_id}")
def delete_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid_lib.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile_id.")
    profile = (
        db.query(PaymentProfile)
        .filter(PaymentProfile.id == pid, PaymentProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    db.delete(profile)
    db.commit()
    return api_response(True, "Profile deleted.", None)
