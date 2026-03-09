# utils/whatsapp_check.py
# Checks if a phone number is registered on WhatsApp via the whatsapp-send edge function

import os
import requests


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""


def check_whatsapp_number(phone: str) -> bool:
    """
    Check if a phone number is registered on WhatsApp
    by calling the whatsapp-send edge function with action=check_whatsapp.

    Args:
        phone: International phone number without + prefix (e.g., "255712345678")

    Returns:
        True if the number is on WhatsApp, False otherwise.
    """
    if not WHATSAPP_SEND_URL or not SUPABASE_ANON_KEY:
        print("[WhatsApp Check] Missing SUPABASE_URL or SUPABASE_ANON_KEY")
        return False

    try:
        resp = requests.post(
            WHATSAPP_SEND_URL,
            json={"action": "check_whatsapp", "phone": phone, "params": {}},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=15,
        )

        if resp.ok:
            data = resp.json()
            return data.get("is_whatsapp", False)
        else:
            print(f"[WhatsApp Check] Edge function error ({resp.status_code}): {resp.text[:200]}")

    except Exception as e:
        print(f"[WhatsApp Check] Error checking {phone}: {e}")

    return False
