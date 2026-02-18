# utils/helpers.py
# Contains general helper functions used across the application

import random
import logging
from datetime import datetime, timedelta
from math import ceil
import httpx

logger = logging.getLogger(__name__)

def api_response(success: bool, message: str, data=None) -> dict:
    return {"success": success, "message": message, "data": data}

def error_response(message: str, errors: list | None = None) -> dict:
    return {
        "success": False,
        "message": message,
        "errors": errors
    }

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


def paginate(query, page: int = 1, limit: int = 20):
    """
    SQLAlchemy query pagination
    Returns: (items list, pagination dict)
    """
    page = max(page, 1)
    limit = min(max(limit, 1), 100)

    total_items = query.count()
    total_pages = ceil(total_items / limit) if total_items else 1

    items = query.offset((page - 1) * limit).limit(limit).all()

    pagination = {
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1
    }

    return items, pagination

def paginated_response(items, pagination, message="Records retrieved successfully", wrap_items=True):
    if wrap_items:
        data = {"items": items, "pagination": pagination}
    else:
        data = items  # for legacy endpoints returning array directly

    return {
        "success": True,
        "message": message,
        "data": data
    }

def standard_response(
    success: bool,
    message: str,
    data=None,
    errors: list | None = None,
    pagination: dict | None = None,
    wrap_items=True
) -> dict:
    """
    Returns a standard API response consistent with the NURU docs.
    
    - If `success=False`, include `errors`.
    - If `pagination` is provided, wrap `data` with 'items' + 'pagination'.
    """
    response = {
        "success": success,
        "message": message
    }

    if not success:
        response["errors"] = errors or []
    else:
        if pagination:
            # Wrap items with pagination
            if wrap_items:
                response["data"] = {"items": data, "pagination": pagination}
            else:
                response["data"] = data
        else:
            response["data"] = data

    return response


def format_phone_display(phone: str) -> str:
    """
    Convert international format (e.g. 255764413212) to local display (0764413212).
    If the phone starts with '255', replace the prefix with '0'.
    """
    if not phone:
        return ""
    phone = phone.strip().lstrip("+")
    if phone.startswith("255"):
        return "0" + phone[3:]
    return phone


# ─────────────────────────────────────────────────────────────────────────────
# Storage file deletion helper
# Calls the PHP unlink endpoint to physically remove a file from storage.
# This is a *best-effort* call — failures are logged but never raise exceptions
# so that the database record is still cleaned up regardless.
# ─────────────────────────────────────────────────────────────────────────────

def delete_storage_file_sync(file_url: str | None) -> bool:
    """
    Synchronous version for use inside sync FastAPI route handlers.
    Physically delete a file from the remote PHP storage server.
    """
    if not file_url or not file_url.strip():
        return True

    from core.config import DELETE_SERVICE_URL

    try:
        with httpx.Client() as client:
            resp = client.post(
                DELETE_SERVICE_URL,
                data={"file_url": file_url.strip()},
                timeout=10,
            )
        result = resp.json()
        if result.get("success"):
            return True
        else:
            logger.warning("Storage delete failed for %s: %s", file_url, result.get("message"))
            return False
    except Exception as exc:
        logger.warning("Storage delete error for %s: %s", file_url, exc)
        return False


async def delete_storage_file(file_url: str | None) -> bool:
    """
    Physically delete a file from the remote PHP storage server.

    Args:
        file_url: The full public URL of the file, e.g.
                  https://data.sewmrtechnologies.com/storage/nuru/photo-libraries/…/photo.jpg

    Returns:
        True if the file was successfully deleted (or was already gone).
        False on any error (the error is logged but not re-raised).
    """
    if not file_url or not file_url.strip():
        return True  # Nothing to delete

    from core.config import DELETE_SERVICE_URL

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                DELETE_SERVICE_URL,
                data={"file_url": file_url.strip()},
                timeout=10,
            )
        result = resp.json()
        if result.get("success"):
            return True
        else:
            logger.warning("Storage delete failed for %s: %s", file_url, result.get("message"))
            return False
    except Exception as exc:
        logger.warning("Storage delete error for %s: %s", file_url, exc)
        return False