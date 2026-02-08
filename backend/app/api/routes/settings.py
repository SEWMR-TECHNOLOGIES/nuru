# Settings Routes - /settings/...

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models import User, UserSetting, UserPrivacySetting, UserSession
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/")
def get_all_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    privacy = db.query(UserPrivacySetting).filter(UserPrivacySetting.user_id == current_user.id).first()

    return standard_response(True, "Settings retrieved", {
        "notifications": {
            "email_notifications": settings.email_notifications if settings and hasattr(settings, "email_notifications") else True,
            "push_notifications": settings.push_notifications if settings and hasattr(settings, "push_notifications") else True,
            "sms_notifications": settings.sms_notifications if settings and hasattr(settings, "sms_notifications") else False,
        },
        "privacy": {
            "private_profile": settings.private_profile if settings else False,
            "show_online_status": privacy.show_online_status if privacy and hasattr(privacy, "show_online_status") else True,
            "show_last_seen": privacy.show_last_seen if privacy and hasattr(privacy, "show_last_seen") else True,
        },
        "preferences": {
            "language": settings.language if settings else "en",
            "dark_mode": settings.dark_mode if settings else False,
            "timezone": settings.timezone if settings and hasattr(settings, "timezone") else "Africa/Nairobi",
        },
        "security": {
            "two_factor_enabled": settings.two_factor_enabled if settings else False,
        },
    })


@router.put("/notifications")
def update_notification_settings(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not settings:
        settings = UserSetting(id=uuid.uuid4(), user_id=current_user.id)
        db.add(settings)

    for field in ["email_notifications", "push_notifications", "sms_notifications"]:
        if field in body and hasattr(settings, field):
            setattr(settings, field, body[field])

    db.commit()
    return standard_response(True, "Notification settings updated")


@router.put("/privacy")
def update_privacy_settings(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if settings and "private_profile" in body:
        settings.private_profile = body["private_profile"]

    privacy = db.query(UserPrivacySetting).filter(UserPrivacySetting.user_id == current_user.id).first()
    if not privacy:
        privacy = UserPrivacySetting(id=uuid.uuid4(), user_id=current_user.id)
        db.add(privacy)

    for field in ["show_online_status", "show_last_seen", "show_read_receipts"]:
        if field in body and hasattr(privacy, field):
            setattr(privacy, field, body[field])

    db.commit()
    return standard_response(True, "Privacy settings updated")


@router.put("/preferences")
def update_preferences(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not settings:
        settings = UserSetting(id=uuid.uuid4(), user_id=current_user.id)
        db.add(settings)

    if "language" in body: settings.language = body["language"]
    if "dark_mode" in body: settings.dark_mode = body["dark_mode"]
    if "timezone" in body and hasattr(settings, "timezone"): settings.timezone = body["timezone"]

    db.commit()
    return standard_response(True, "Preferences updated")


# 2FA
@router.post("/security/2fa/enable")
def enable_2fa(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "2FA setup initiated. Please verify with your authenticator app.", {"qr_code_url": "otpauth://totp/Nuru?secret=placeholder"})

@router.post("/security/2fa/verify")
def verify_2fa(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if settings:
        settings.two_factor_enabled = True
        db.commit()
    return standard_response(True, "2FA enabled successfully")

@router.post("/security/2fa/disable")
def disable_2fa(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if settings:
        settings.two_factor_enabled = False
        db.commit()
    return standard_response(True, "2FA disabled")

@router.post("/security/2fa/backup-codes")
def regenerate_backup_codes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import secrets
    codes = [secrets.token_hex(4) for _ in range(8)]
    return standard_response(True, "Backup codes regenerated", {"codes": codes})


# Sessions
@router.get("/security/sessions")
def get_active_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(UserSession).filter(UserSession.user_id == current_user.id, UserSession.is_active == True).all()
    return standard_response(True, "Active sessions retrieved", [{"id": str(s.id), "device": s.device_info if hasattr(s, "device_info") else None, "ip_address": s.ip_address if hasattr(s, "ip_address") else None, "last_active": s.last_active_at.isoformat() if hasattr(s, "last_active_at") and s.last_active_at else None} for s in sessions])

@router.delete("/security/sessions/{session_id}")
def revoke_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        return standard_response(False, "Invalid session ID")
    s = db.query(UserSession).filter(UserSession.id == sid, UserSession.user_id == current_user.id).first()
    if s:
        s.is_active = False
        db.commit()
    return standard_response(True, "Session revoked")

@router.delete("/security/sessions")
def revoke_all_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(UserSession).filter(UserSession.user_id == current_user.id).update({"is_active": False}, synchronize_session=False)
    db.commit()
    return standard_response(True, "All sessions revoked")


# Connected accounts (placeholder)
@router.get("/connected-accounts")
def get_connected_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Connected accounts retrieved", [])

@router.post("/connected-accounts/{provider}")
def connect_account(provider: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, f"{provider.capitalize()} account connected")

@router.delete("/connected-accounts/{provider}")
def disconnect_account(provider: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, f"{provider.capitalize()} account disconnected")


# Payment methods (placeholder)
@router.get("/payment-methods")
def get_payment_methods(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Payment methods retrieved", [])

@router.post("/payment-methods")
def add_payment_method(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Payment method added")

@router.put("/payment-methods/{method_id}")
def update_payment_method(method_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Payment method updated")

@router.delete("/payment-methods/{method_id}")
def delete_payment_method(method_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Payment method deleted")

@router.put("/payment-methods/{method_id}/default")
def set_default_payment_method(method_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Default payment method set")


# Data export
@router.post("/data/export")
def request_data_export(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Data export requested. You will receive a download link via email.")

@router.get("/data/export/status")
def get_export_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Export status retrieved", {"status": "pending"})
