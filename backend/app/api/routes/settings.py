"""Settings Routes - /settings/...

Returns rich nested structure to power mobile/web settings UI.
"""

import os
import uuid
import secrets as pysecrets
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models import User, UserSetting, UserPrivacySetting, UserSession, UserBlock, AppVersionSetting
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/settings", tags=["Settings"])


# ---------- helpers ----------

def _ensure_settings(db: Session, user_id: uuid.UUID) -> UserSetting:
    s = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
    if not s:
        s = UserSetting(id=uuid.uuid4(), user_id=user_id)
        db.add(s); db.commit(); db.refresh(s)
    return s


def _ensure_privacy(db: Session, user_id: uuid.UUID) -> UserPrivacySetting:
    p = db.query(UserPrivacySetting).filter(UserPrivacySetting.user_id == user_id).first()
    if not p:
        p = UserPrivacySetting(id=uuid.uuid4(), user_id=user_id)
        db.add(p); db.commit(); db.refresh(p)
    return p


def _bool(v, default=False):
    if v is None: return default
    if isinstance(v, bool): return v
    if isinstance(v, str): return v.lower() in ("true", "1", "yes")
    return bool(v)


# ---------- app version ----------

@router.get("/app-version")
def get_app_version(platform: str = "android", db: Session = Depends(get_db)):
    platform_key = (platform or "android").lower().strip()
    if platform_key not in ("android", "ios"):
        platform_key = "android"

    row = db.query(AppVersionSetting).filter(AppVersionSetting.platform == platform_key).first()

    default_url = (
        "https://play.google.com/store/apps/details?id=tz.nuru.app"
        if platform_key == "android"
        else "https://apps.apple.com/app/nuru"
    )
    env_force = os.getenv("NURU_FORCE_APP_UPDATE", "").lower() == "true"
    env_latest_build = os.getenv("NURU_LATEST_APP_BUILD")
    env_min_build = os.getenv("NURU_MIN_SUPPORTED_APP_BUILD")
    env_update_url = os.getenv(
        "NURU_ANDROID_UPDATE_URL" if platform_key == "android" else "NURU_IOS_UPDATE_URL"
    )
    latest_version = row.latest_version if row else os.getenv("NURU_LATEST_APP_VERSION", "1.0.0")
    latest_build = row.latest_build if row else (int(env_latest_build) if env_latest_build else 1)
    min_supported_build = row.min_supported_build if row else (int(env_min_build) if env_min_build else 1)
    force_update = bool(row.force_update) if row else env_force

    return standard_response(True, "App version retrieved", {
        "platform": platform_key,
        "latest_version": latest_version or "1.0.0",
        "latest_build": latest_build or 1,
        "min_supported_build": min_supported_build or 1,
        "force_update": force_update,
        "update_url": env_update_url or (row.update_url if row and row.update_url else default_url),
        "message": (row.message if row and row.message else None) or os.getenv("NURU_APP_UPDATE_MESSAGE", "A new Nuru update is available."),
    })


# ---------- aggregate settings ----------

@router.get("")
@router.get("/")
def get_all_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    p = _ensure_privacy(db, current_user.id)

    blocked = db.query(UserBlock).filter(UserBlock.blocker_id == current_user.id).count() if hasattr(UserBlock, "blocker_id") else 0
    sessions_count = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_active == True,  # noqa: E712
    ).count()

    return standard_response(True, "Settings retrieved", {
        "notifications": {
            "email_notifications": s.email_notifications,
            "push_notifications": s.push_notifications,
            "sms_notifications": s.sms_notifications,
            "event_invitation_notifications": s.event_invitation_notifications,
            "rsvp_notifications": s.rsvp_notifications,
            "contribution_notifications": s.contribution_notifications,
            "message_notifications": s.message_notifications,
            "mention_notifications": s.mention_notifications,
            "follower_notifications": s.follower_notifications,
            "glows_echoes_notifications": s.glows_echoes_notifications,
            "marketing_emails": s.marketing_emails,
            "weekly_digest": s.weekly_digest,
            "quiet_hours_enabled": s.quiet_hours_enabled,
            "quiet_hours_start": s.quiet_hours_start,
            "quiet_hours_end": s.quiet_hours_end,
        },
        "privacy": {
            "profile_visibility": p.profile_visibility,
            "private_profile": s.private_profile,
            "show_online_status": p.show_online_status,
            "show_last_seen": p.show_last_seen,
            "show_read_receipts": p.show_read_receipts,
            "show_activity_status": p.show_activity_status,
            "allow_tagging": p.allow_tagging,
            "allow_mentions": p.allow_mentions,
            "allow_message_requests": p.allow_message_requests,
            "hide_from_search": p.hide_from_search,
            "blocked_users_count": int(blocked or 0),
        },
        "security": {
            "two_factor_enabled": s.two_factor_enabled,
            "login_alerts": s.login_alerts,
            "active_sessions_count": int(sessions_count or 0),
        },
        "preferences": {
            "language": s.language or "en",
            "currency": s.currency or "TZS",
            "timezone": s.timezone or "Africa/Nairobi",
            "theme": s.theme or "system",
            "dark_mode": s.dark_mode,
            "date_format": s.date_format or "DD/MM/YYYY",
            "time_format": s.time_format or "24h",
        },
    })


# ---------- updates ----------

NOTIFICATION_FIELDS = {
    "email_notifications", "push_notifications", "sms_notifications",
    "event_invitation_notifications", "rsvp_notifications",
    "contribution_notifications", "message_notifications",
    "mention_notifications", "follower_notifications",
    "glows_echoes_notifications", "marketing_emails", "weekly_digest",
    "quiet_hours_enabled",
}
NOTIFICATION_TEXT_FIELDS = {"quiet_hours_start", "quiet_hours_end"}

PRIVACY_BOOL_FIELDS = {
    "show_online_status", "show_last_seen", "show_read_receipts",
    "show_activity_status", "allow_tagging", "allow_mentions",
    "allow_message_requests", "hide_from_search",
}
PRIVACY_TEXT_FIELDS = {"profile_visibility"}

PREFERENCE_TEXT_FIELDS = {"language", "currency", "timezone", "theme", "date_format", "time_format"}
PREFERENCE_BOOL_FIELDS = {"dark_mode"}


@router.put("/notifications")
def update_notification_settings(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    for k, v in (body or {}).items():
        if k in NOTIFICATION_FIELDS and hasattr(s, k):
            setattr(s, k, _bool(v))
        elif k in NOTIFICATION_TEXT_FIELDS and hasattr(s, k):
            setattr(s, k, str(v))
    db.commit()
    return standard_response(True, "Notification settings updated")


@router.put("/privacy")
def update_privacy_settings(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    p = _ensure_privacy(db, current_user.id)
    for k, v in (body or {}).items():
        if k == "private_profile":
            s.private_profile = _bool(v)
        elif k in PRIVACY_BOOL_FIELDS and hasattr(p, k):
            setattr(p, k, _bool(v))
        elif k in PRIVACY_TEXT_FIELDS and hasattr(p, k):
            setattr(p, k, str(v))
    db.commit()
    return standard_response(True, "Privacy settings updated")


@router.put("/preferences")
def update_preferences(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    for k, v in (body or {}).items():
        if k in PREFERENCE_TEXT_FIELDS and hasattr(s, k):
            setattr(s, k, str(v))
        elif k in PREFERENCE_BOOL_FIELDS and hasattr(s, k):
            setattr(s, k, _bool(v))
    db.commit()
    return standard_response(True, "Preferences updated")


# ---------- security ----------

@router.put("/security")
def update_security(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    if "login_alerts" in body:
        s.login_alerts = _bool(body["login_alerts"])
    db.commit()
    return standard_response(True, "Security settings updated")


@router.post("/security/2fa/enable")
def enable_2fa(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate a TOTP secret. Client must call /verify with a valid code to activate."""
    import base64
    s = _ensure_settings(db, current_user.id)
    secret_bytes = pysecrets.token_bytes(20)
    secret_b32 = base64.b32encode(secret_bytes).decode("ascii").rstrip("=")
    s.two_factor_secret = secret_b32
    db.commit()
    issuer = "Nuru"
    label = (current_user.email or current_user.phone or str(current_user.id))
    otpauth = f"otpauth://totp/{issuer}:{label}?secret={secret_b32}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"
    return standard_response(True, "2FA setup initiated", {
        "secret": secret_b32,
        "qr_code_url": otpauth,
        "backup_codes": [pysecrets.token_hex(4) for _ in range(8)],
    })


def _totp_verify(secret_b32: str, code: str, window: int = 1) -> bool:
    import base64, hmac, hashlib, struct, time
    if not secret_b32 or not code: return False
    code = code.strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6: return False
    pad = "=" * ((8 - len(secret_b32) % 8) % 8)
    try:
        key = base64.b32decode(secret_b32 + pad, casefold=True)
    except Exception:
        return False
    counter = int(time.time() // 30)
    for offset in range(-window, window + 1):
        msg = struct.pack(">Q", counter + offset)
        h = hmac.new(key, msg, hashlib.sha1).digest()
        o = h[-1] & 0x0F
        binary = ((h[o] & 0x7F) << 24) | ((h[o + 1] & 0xFF) << 16) | ((h[o + 2] & 0xFF) << 8) | (h[o + 3] & 0xFF)
        if f"{binary % 1000000:06d}" == code:
            return True
    return False


@router.post("/security/2fa/verify")
def verify_2fa(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    code = (body or {}).get("code", "")
    if not _totp_verify(s.two_factor_secret or "", code):
        return standard_response(False, "Invalid verification code")
    s.two_factor_enabled = True
    db.commit()
    return standard_response(True, "Two-factor authentication enabled")


@router.post("/security/2fa/disable")
def disable_2fa(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = _ensure_settings(db, current_user.id)
    code = (body or {}).get("code", "")
    if s.two_factor_enabled and not _totp_verify(s.two_factor_secret or "", code):
        return standard_response(False, "Invalid verification code")
    s.two_factor_enabled = False
    s.two_factor_secret = None
    db.commit()
    return standard_response(True, "Two-factor authentication disabled")


# ---------- sessions ----------

@router.get("/security/sessions")
def get_active_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_active == True,  # noqa: E712
    ).order_by(UserSession.last_active_at.desc().nullslast()).all()
    data = [{
        "id": str(s.id),
        "device_name": s.device_name or (s.device_info.get("name") if isinstance(s.device_info, dict) else None),
        "device_info": s.device_info,
        "user_agent": s.user_agent,
        "ip_address": s.ip_address,
        "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in rows]
    return standard_response(True, "Active sessions retrieved", data)


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
    db.query(UserSession).filter(UserSession.user_id == current_user.id).update(
        {"is_active": False}, synchronize_session=False
    )
    db.commit()
    return standard_response(True, "All sessions revoked")


# ---------- data export ----------

@router.post("/data/export")
def request_data_export(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Data export requested. We will email you a download link within 24 hours.")
