# utils/helpers.py
# Contains general helper functions used across the application

import random
from datetime import datetime, timedelta

def api_response(success: bool, message: str, data=None) -> dict:
    return {"success": success, "message": message, "data": data}

def mask_email(email: str) -> str:
    try:
        local, domain = email.split("@")
        if len(local) <= 2:
            local_masked = local[0] + "***"
        else:
            local_masked = local[0] + "***" + local[-1]
        return f"{local_masked}@{domain}"
    except Exception:
        return "***"

def mask_phone(phone: str) -> str:
    # Show country code and last 2–3 digits only
    if len(phone) < 6:
        return "***"
    return phone[:4] + "****" + phone[-2:]

def generate_otp(length=6):
    return "".join([str(random.randint(0, 9)) for _ in range(length)])

def get_expiry(minutes=5):
    return datetime.utcnow() + timedelta(minutes=minutes)

def format_price(price):
    if price is None:
        return None
    return f"{int(price):,}"
