# utils/otp_router.py
# Determines the best channel (WhatsApp or SMS) to send OTP and dispatches accordingly.
# Strategy: Try sending via WhatsApp first. If the number is not on WhatsApp
# (API returns not_on_whatsapp), fall back to SMS for TZ numbers or return error for intl.

import os
import requests
from utils.validation_functions import is_tanzanian_number


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""


class OtpDeliveryResult:
    """Result of an OTP delivery attempt."""
    def __init__(self, channel: str, success: bool, message: str):
        self.channel = channel      # "whatsapp" | "sms"
        self.success = success
        self.message = message


def _send_otp_via_whatsapp(phone: str, otp_code: str) -> dict:
    """
    Send OTP via WhatsApp using the whatsapp-send edge function.
    Returns dict with keys: success, not_on_whatsapp
    """
    if not WHATSAPP_SEND_URL or not SUPABASE_ANON_KEY:
        print("[OTP WhatsApp] Missing SUPABASE_URL or SUPABASE_ANON_KEY")
        return {"success": False, "not_on_whatsapp": False}

    try:
        resp = requests.post(
            WHATSAPP_SEND_URL,
            json={
                "action": "otp_verification",
                "phone": phone,
                "params": {"otp_code": otp_code},
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=15,
        )

        data = resp.json() if resp.ok or resp.status_code < 500 else {}
        print(f"[OTP WhatsApp] Response ({resp.status_code}): {str(data)[:300]}")

        if data.get("success"):
            return {"success": True, "not_on_whatsapp": False}
        elif data.get("not_on_whatsapp"):
            return {"success": False, "not_on_whatsapp": True}
        else:
            return {"success": False, "not_on_whatsapp": False}

    except Exception as e:
        print(f"[OTP WhatsApp] Error sending to {phone}: {e}")
        return {"success": False, "not_on_whatsapp": False}


def route_and_send_otp(phone: str, otp_code: str, send_sms_fn) -> OtpDeliveryResult:
    """
    Determine the best delivery channel and send OTP.

    Strategy (Cloud API compatible):
        1. Try sending OTP via WhatsApp directly
        2. If WhatsApp send succeeds → done (channel=whatsapp)
        3. If WhatsApp returns "not_on_whatsapp":
           - TZ number → fall back to SMS
           - International → return error (must have WhatsApp)
        4. If WhatsApp fails for other reasons:
           - TZ number → fall back to SMS
           - International → return error

    Args:
        phone: Normalised international number without + (e.g., "255712345678")
        otp_code: The OTP code to send
        send_sms_fn: Callable(phone, otp_code) -> bool  — sends SMS

    Returns:
        OtpDeliveryResult with channel, success, and user-facing message
    """
    is_tz = is_tanzanian_number(phone)

    # Step 1: Try sending via WhatsApp directly
    try:
        wa_result = _send_otp_via_whatsapp(phone, otp_code)

        if wa_result["success"]:
            return OtpDeliveryResult(
                channel="whatsapp",
                success=True,
                message="Verification code sent via WhatsApp. Please check your WhatsApp messages."
            )

        if wa_result["not_on_whatsapp"]:
            # Number is not on WhatsApp
            if is_tz:
                # Fall back to SMS for Tanzanian numbers
                sms_ok = send_sms_fn(phone, otp_code)
                return OtpDeliveryResult(
                    channel="sms",
                    success=sms_ok,
                    message="Verification code sent via SMS." if sms_ok else "Failed to send verification code via SMS."
                )
            else:
                # International number not on WhatsApp — still try SMS as last resort
                sms_ok = send_sms_fn(phone, otp_code)
                if sms_ok:
                    return OtpDeliveryResult(
                        channel="sms",
                        success=True,
                        message="Verification code sent via SMS."
                    )
                return OtpDeliveryResult(
                    channel="whatsapp",
                    success=False,
                    message="We couldn't reach this number via WhatsApp or SMS. Please ensure the number is correct and try again."
                )

        # WhatsApp failed for other reasons (API error, config issue, etc.)
        if is_tz:
            sms_ok = send_sms_fn(phone, otp_code)
            return OtpDeliveryResult(
                channel="sms",
                success=sms_ok,
                message="Verification code sent via SMS." if sms_ok else "Failed to send verification code."
            )
        return OtpDeliveryResult(
            channel="whatsapp",
            success=False,
            message="Failed to send verification code via WhatsApp. Please try again."
        )

    except Exception as e:
        print(f"[OTP Router] Error: {e}")
        if is_tz:
            try:
                sms_ok = send_sms_fn(phone, otp_code)
                return OtpDeliveryResult(
                    channel="sms",
                    success=sms_ok,
                    message="Verification code sent via SMS." if sms_ok else "Failed to send verification code."
                )
            except Exception as sms_e:
                print(f"[OTP Router] SMS fallback error: {sms_e}")
        return OtpDeliveryResult(
            channel="whatsapp",
            success=False,
            message="Failed to send verification code. Please try again."
        )
