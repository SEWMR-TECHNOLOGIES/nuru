# Settings Routes - /settings/...
# Handles user settings: notifications, privacy, security, preferences

from fastapi import APIRouter

from models import (
    User,
    UserSetting,
    UserPrivacySetting,
    UserTwoFactorSecret,
    UserSession,
    UserSocialAccount,
)

router = APIRouter(prefix="/settings", tags=["Settings"])


# ──────────────────────────────────────────────
# Get All Settings
# ──────────────────────────────────────────────
@router.get("/")
async def get_all_settings():
    """Returns all settings for the authenticated user."""
    pass


# ──────────────────────────────────────────────
# NOTIFICATION SETTINGS
# ──────────────────────────────────────────────
@router.put("/notifications")
async def update_notification_settings():
    """Updates notification settings."""
    pass


# ──────────────────────────────────────────────
# PRIVACY SETTINGS
# ──────────────────────────────────────────────
@router.put("/privacy")
async def update_privacy_settings():
    """Updates privacy settings."""
    pass


# ──────────────────────────────────────────────
# PREFERENCES
# ──────────────────────────────────────────────
@router.put("/preferences")
async def update_preferences():
    """Updates user preferences (language, theme, etc.)."""
    pass


# ──────────────────────────────────────────────
# SECURITY - TWO FACTOR AUTH
# ──────────────────────────────────────────────
@router.post("/security/2fa/enable")
async def enable_2fa():
    """Initiates 2FA setup."""
    pass


@router.post("/security/2fa/verify")
async def verify_2fa():
    """Verifies and completes 2FA setup."""
    pass


@router.post("/security/2fa/disable")
async def disable_2fa():
    """Disables 2FA."""
    pass


@router.post("/security/2fa/backup-codes")
async def regenerate_backup_codes():
    """Regenerates 2FA backup codes."""
    pass


# ──────────────────────────────────────────────
# SECURITY - SESSIONS
# ──────────────────────────────────────────────
@router.get("/security/sessions")
async def get_active_sessions():
    """Returns active login sessions."""
    pass


@router.delete("/security/sessions/{session_id}")
async def revoke_session(session_id: str):
    """Revokes a specific session."""
    pass


@router.delete("/security/sessions")
async def revoke_all_sessions():
    """Revokes all sessions except current."""
    pass


# ──────────────────────────────────────────────
# CONNECTED ACCOUNTS
# ──────────────────────────────────────────────
@router.get("/connected-accounts")
async def get_connected_accounts():
    """Returns connected social accounts."""
    pass


@router.post("/connected-accounts/{provider}")
async def connect_account(provider: str):
    """Connects a social account."""
    pass


@router.delete("/connected-accounts/{provider}")
async def disconnect_account(provider: str):
    """Disconnects a social account."""
    pass


# ──────────────────────────────────────────────
# PAYMENT METHODS
# ──────────────────────────────────────────────
@router.get("/payment-methods")
async def get_payment_methods():
    """Returns saved payment methods."""
    pass


@router.post("/payment-methods")
async def add_payment_method():
    """Adds a new payment method."""
    pass


@router.put("/payment-methods/{method_id}")
async def update_payment_method(method_id: str):
    """Updates a payment method."""
    pass


@router.delete("/payment-methods/{method_id}")
async def delete_payment_method(method_id: str):
    """Deletes a payment method."""
    pass


@router.put("/payment-methods/{method_id}/default")
async def set_default_payment_method(method_id: str):
    """Sets a payment method as default."""
    pass


# ──────────────────────────────────────────────
# DATA EXPORT
# ──────────────────────────────────────────────
@router.post("/data/export")
async def request_data_export():
    """Requests export of all user data."""
    pass


@router.get("/data/export/status")
async def get_export_status():
    """Returns status of data export request."""
    pass
