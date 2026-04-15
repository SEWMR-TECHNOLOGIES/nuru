"""
Task: Async SMS / OTP / email sending
======================================
Moves blocking network calls (SMS, email) out of the request path.
"""

from core.celery_app import celery_app


@celery_app.task(
    name="tasks.notifications.send_otp_async",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    rate_limit="30/m",
)
def send_otp_async(self, phone: str, code: str, first_name: str = "", context: str = "verification"):
    """
    Send OTP via WhatsApp-first routing with SMS fallback.
    Runs outside the request cycle so API response is instant.
    """
    try:
        from utils.notification_service import send_otp_with_routing
        result = send_otp_with_routing(phone, code, first_name, context)
        if not result.success:
            raise Exception(f"OTP delivery failed: {result.message}")
        return {"success": True, "channel": result.channel}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    name="tasks.notifications.send_email_async",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    rate_limit="30/m",
)
def send_email_async(self, email_type: str, to_email: str, code: str, first_name: str = ""):
    """
    Send email (verification or password reset) outside request path.
    """
    try:
        from utils.notification_service import send_verification_email, send_password_reset_email
        if email_type == "password_reset":
            send_password_reset_email(to_email, code, first_name)
        else:
            send_verification_email(to_email, code, first_name)
        return {"success": True, "type": email_type}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    name="tasks.notifications.send_welcome_sms_async",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def send_welcome_sms_async(self, phone: str, message: str):
    """Send welcome / promotional SMS asynchronously."""
    try:
        from services.SewmrSmsClient import SewmrSmsClient
        client = SewmrSmsClient()
        result = client.send_quick_sms(message=message, recipients=[phone])
        if not result.get("success"):
            raise Exception(f"SMS failed: {result.get('error')}")
        return {"success": True}
    except Exception as exc:
        raise self.retry(exc=exc)
