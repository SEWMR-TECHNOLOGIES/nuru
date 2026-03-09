# utils/otp_router.py
# Determines the best channel (WhatsApp or SMS) to send OTP and dispatches accordingly.
# WhatsApp OTP is sent via the whatsapp-send edge function.

import os
import requests
from utils.validation_functions import is_tanzanian_number
from utils.whatsapp_check import check_whatsapp_number


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""


class OtpDeliveryResult:
    """Result of an OTP delivery attempt."""
    def __init__(self, channel: str, success: bool, message: str):
        self.channel = channel      # "whatsapp" | "sms"
        self.success = success
        self.message = message


def _send_otp_via_whatsapp(phone: str, otp_code: str) -> bool:
    """Send OTP via WhatsApp using the whatsapp-send edge function."""
    if not WHATSAPP_SEND_URL or not SUPABASE_ANON_KEY:
        print("[OTP WhatsApp] Missing SUPABASE_URL or SUPABASE_ANON_KEY")
        return False

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
        if resp.ok:
            data = resp.json()
            return data.get("success", False)
        else:
            print(f"[OTP WhatsApp] Edge function error ({resp.status_code}): {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[OTP WhatsApp] Error sending to {phone}: {e}")
        return False


def route_and_send_otp(phone: str, otp_code: str, send_sms_fn) -> OtpDeliveryResult:
    """
    Determine the best delivery channel and send OTP.

    Logic:
        1. Check if the number is on WhatsApp
        2. If YES → send via WhatsApp (edge function)
        3. If NO and Tanzanian → send via SMS
        4. If NO and international → return error (number not on WhatsApp)

    Args:
        phone: Normalised international number without + (e.g., "255712345678")
        otp_code: The OTP code to send
        send_sms_fn: Callable(phone, otp_code) -> bool  — sends SMS

    Returns:
        OtpDeliveryResult with channel, success, and user-facing message
    """
    is_tz = is_tanzanian_number(phone)
    is_on_whatsapp = check_whatsapp_number(phone)

    if is_on_whatsapp:
        # Send via WhatsApp
        try:
            success = _send_otp_via_whatsapp(phone, otp_code)
            if success:
                return OtpDeliveryResult(
                    channel="whatsapp",
                    success=True,
                    message="Verification code sent via WhatsApp. Please check your WhatsApp messages."
                )
            else:
                # WhatsApp send failed, try SMS if Tanzanian
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
            print(f"[OTP Router] WhatsApp send error: {e}")
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
                message="Failed to send verification code. Please try again."
            )

    elif is_tz:
        # Not on WhatsApp but Tanzanian → send via SMS
        try:
            success = send_sms_fn(phone, otp_code)
            return OtpDeliveryResult(
                channel="sms",
                success=success,
                message="Verification code sent via SMS." if success else "Failed to send verification code via SMS."
            )
        except Exception as e:
            print(f"[OTP Router] SMS send error: {e}")
            return OtpDeliveryResult(
                channel="sms",
                success=False,
                message="Failed to send verification code. Please try again."
            )

    else:
        # International number not on WhatsApp
        return OtpDeliveryResult(
            channel="whatsapp",
            success=False,
            message="The provided number is not registered on WhatsApp. International numbers must have WhatsApp to receive verification codes."
        )
