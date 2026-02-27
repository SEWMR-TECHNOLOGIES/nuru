# backend/app/api/routes/services.py

from datetime import datetime
import json
import math
import os
import re
import uuid
from typing import List, Optional

import pytz
from fastapi import APIRouter, Depends
from requests import Session


from core.database import get_db
from models import (
    EventTypeService,
    ServiceType, UserService, ServicePackage
)

from utils.helpers import format_price, standard_response

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EAT = pytz.timezone("Africa/Nairobi")
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
VALID_SORT_FIELDS = {"created_at", "start_date", "title"}
VALID_SORT_ORDERS = {"asc", "desc"}
VALID_STATUS_FILTERS = {"draft", "confirmed", "cancelled", "completed", "all"}

router = APIRouter()


# =============================================================================
# 3.8 GET /recommendations/{event_type_id}
# =============================================================================

@router.get("/{event_type_id}")
def get_event_recommendations(event_type_id: str, db: Session = Depends(get_db)):
    """
    Fetch recommended services for a given event type.
    Returns dynamic price ranges based on available providers.
    """
    try:
        # Validate UUID
        try:
            _eid = uuid.UUID(event_type_id)
        except ValueError:
            return standard_response(False, "Invalid event_type_id format. Must be a valid UUID.")

        recommendations = (
            db.query(EventTypeService)
            .filter(EventTypeService.event_type_id == event_type_id)
            .all()
        )
        if not recommendations:
            return standard_response(True, "No recommendations found.", [])

        result = []
        for rec in recommendations:
            priority = rec.priority.value if hasattr(rec.priority, "value") else (rec.priority or "medium")

            services = (
                db.query(UserService)
                .filter(
                    UserService.service_type_id == rec.service_type_id,
                    UserService.is_active == True,
                    UserService.availability == "available",
                    UserService.is_verified == True,
                    UserService.verification_status == "verified",
                )
                .all()
            )

            min_price = max_price = None
            if services:
                min_price = min((s.min_price for s in services if s.min_price is not None), default=None)
                max_price = max((s.max_price for s in services if s.max_price is not None), default=None)
                price_range = (
                    f"TZS {format_price(min_price)} - TZS {format_price(max_price)}"
                    if min_price is not None and max_price is not None
                    else "N/A"
                )
            else:
                price_range = "N/A"

            result.append({
                "id": str(rec.id),
                "service_type_id": str(rec.service_type_id),
                "service_type_name": rec.service_type.name if rec.service_type else None,
                "category_name": (
                    rec.service_type.category.name
                    if rec.service_type and hasattr(rec.service_type, "category") and rec.service_type.category
                    else None
                ),
                "priority": priority,
                "is_mandatory": rec.is_mandatory,
                "description": rec.description,
                "min_price": format_price(min_price) if min_price else None,
                "max_price": format_price(max_price) if max_price else None,
                "estimated_cost": price_range,
                "available_providers": len(services),
            })

        return standard_response(True, "Recommendations retrieved successfully.", result)
    except Exception as e:
        return standard_response(False, f"Failed to fetch recommendations: {str(e)}")

