import requests
from services.SewmrSmsClient import SewmrSmsClient
from utils.otp_router import route_and_send_otp, OtpDeliveryResult

async def send_verification_sms(phone: str, code: str, first_name: str = ""):
    """
    Sends verification SMS using Sewmr SMS API.
    """
    client = SewmrSmsClient()
    message = (
        f"Hello {first_name}, use the code {code} to activate your Nuru account. "
    )
    
    try:
        result = client.send_quick_sms(message=message, recipients=[phone])
        if not result.get("success"):
            raise Exception(result.get("error", "We couldn't send the verification code. Please try again."))
    except Exception as e:
        print("Failed to send verification SMS:", e)
        raise e

async def send_business_phone_otp(phone: str, code: str, first_name: str = ""):
    """
    Sends OTP for business phone verification.
    """
    client = SewmrSmsClient()
    message = (
        f"Hello {first_name}, use the code {code} to verify your business phone number on Nuru. "
    )

    try:
        result = client.send_quick_sms(message=message, recipients=[phone])
        if not result.get("success"):
            raise Exception(result.get("error", "We couldn't send the verification code. Please try again."))
    except Exception as e:
        print("Failed to send business phone OTP:", e)
        raise e

def send_verification_email(to_email: str, code: str, first_name: str = ""):
    """
    Sends verification code email via PHP API.
    """
    payload = {
        "to_email": to_email,
        "code": code,
        "first_name": first_name
    }

    try:
        response = requests.post(
            "https://api.sewmrtechnologies.com/mail/nuru/send-account-activation-otp.php",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        result = response.json()
        if not result.get("success"):
            raise Exception(result.get("message", "We couldn't send the verification email. Please try again."))
    except Exception as e:
        print("Failed to send verification email:", e)
        raise e

def send_password_reset_email(to_email: str, token: str, first_name: str = ""):
    payload = {
        "to_email": to_email,
        "code": token,
        "first_name": first_name
    }

    response = requests.post(
        "https://api.sewmrtechnologies.com/mail/nuru/send-password-reset.php",
        json=payload,
        timeout=10
    )

    response.raise_for_status()
    result = response.json()

    if not result.get("success"):
        raise Exception(result.get("message", "We couldn't send the reset email. Please try again."))


def _send_sms_sync(phone: str, otp_code: str, message_template: str = "") -> bool:
    """
    Synchronous SMS sender compatible with route_and_send_otp's send_sms_fn callback.
    Returns True on success, False on failure.
    """
    client = SewmrSmsClient()
    message = message_template or f"Your Nuru verification code is {otp_code}"
    try:
        result = client.send_quick_sms(message=message, recipients=[phone])
        return bool(result.get("success"))
    except Exception as e:
        print(f"[SMS sync] Failed to send to {phone}: {e}")
        return False


def send_otp_with_routing(phone: str, code: str, first_name: str = "", context: str = "verification") -> OtpDeliveryResult:
    """
    Send OTP using WhatsApp-first routing with SMS fallback.
    This is the single entry point all OTP sends should use.

    On the VPS the heavy WhatsApp/SMS HTTPS calls are dispatched to a
    Celery worker (``tasks.notifications.send_otp_async``) so the auth
    request returns instantly. We still return a success-shaped
    ``OtpDeliveryResult`` so existing callers don't change.

    Args:
        phone: Normalised phone number (e.g. "255712345678")
        code: The OTP code
        first_name: User's first name for personalised SMS
        context: "verification" | "business_phone" | "password_reset"
    """
    try:
        from core.celery_app import CELERY_ENABLED
    except Exception:
        CELERY_ENABLED = False

    if CELERY_ENABLED:
        try:
            from tasks.notifications import send_otp_async
            send_otp_async.delay(phone, code, first_name, context)
            return OtpDeliveryResult(channel="queued", success=True, message="OTP queued for delivery")
        except Exception as e:
            print(f"[OTP] enqueue failed, sending inline: {e}")

    if context == "business_phone":
        msg = f"Hello {first_name}, use the code {code} to verify your business phone number on Nuru. "
    elif context == "password_reset":
        msg = f"Hello {first_name}, use the code {code} to reset your Nuru password. "
    else:
        msg = f"Hello {first_name}, use the code {code} to activate your Nuru account. "

    def sms_fn(ph: str, otp: str) -> bool:
        return _send_sms_sync(ph, otp, msg)

    return route_and_send_otp(phone, code, sms_fn)
