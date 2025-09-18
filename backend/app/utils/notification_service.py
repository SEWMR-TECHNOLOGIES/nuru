import requests
from services.SewmrSmsClient import SewmrSmsClient

async def send_verification_sms(phone: str, code: str, first_name: str = ""):
    """
    Sends verification SMS using Sewmr SMS API.
    Includes first name and a friendly activation message.
    """
    client = SewmrSmsClient()
    message = (
        f"Hello {first_name}, use the verification code {code} to activate your account. "
    )
    
    try:
        result = client.send_quick_sms(message=message, recipients=[phone])
        if not result.get("success"):
            raise Exception(result.get("error", "Failed to send verification SMS"))
    except Exception as e:
        print("Failed to send verification SMS:", e)
        raise e

def send_verification_email(to_email: str, code: str, first_name: str = ""):
    """
    Sends verification code email via PHP API.
    Works like password reset email:
      - completes silently on success
      - raises exception on failure
    """
    payload = {
        "to_email": to_email,
        "code": code,
        "first_name": first_name
    }

    try:
        response = requests.post(
            "https://api.sewmrtechnologies.com/mail/nuru/send-account-activatiion-otp.php",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        result = response.json()
        if not result.get("success"):
            raise Exception(result.get("message", "Failed to send verification email"))
    except Exception as e:
        print("Failed to send verification email:", e)
        raise e
