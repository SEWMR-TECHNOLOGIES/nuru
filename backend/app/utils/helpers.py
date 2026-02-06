# utils/helpers.py
# Contains general helper functions used across the application

import random
from datetime import datetime, timedelta
from math import ceil

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
