
from datetime import datetime
import json
import math
import os
import re
import uuid
from typing import List, Optional

import pytz
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.database import get_db
from models import (
    EventTypeService,
    ServiceType, UserService, ServicePackage, UserServiceRating
)

from utils.helpers import format_price, standard_response, paginate

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EAT = pytz.timezone("Africa/Nairobi")
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
VALID_SORT_FIELDS = {"created_at", "start_date", "title"}
VALID_SORT_ORDERS = {"asc", "desc"}
VALID_STATUS_FILTERS = {"draft", "confirmed", "cancelled", "completed", "all"}

router = APIRouter(prefix="/services", tags=["Public Services"])


# =============================================================================
# 9.1 Search Services
# =============================================================================
@router.get("/")
def search_services(
    q: str = None,
    category_id: str = None,
    service_type_id: str = None,
    event_type_id: str = None,
    location: str = None,
    min_price: float = None,
    max_price: float = None,
    available: bool = False,
    sort_by: str = "rating",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Searches and filters public service listings."""
    
    query = db.query(UserService).filter(
        UserService.is_active == True,
        UserService.is_verified == True,
        UserService.verification_status == "verified"
    )

    if q:
        search = f"%{q}%"
        query = query.filter(UserService.title.ilike(search) | UserService.description.ilike(search))

    if category_id:
        try:
            cid = uuid.UUID(category_id)
            query = query.filter(UserService.category_id == cid)
        except ValueError:
            pass

    if service_type_id:
        try:
            stid = uuid.UUID(service_type_id)
            query = query.filter(UserService.service_type_id == stid)
        except ValueError:
            pass
            
    # Event type logic - find recommended service types
    if event_type_id:
        try:
            etid = uuid.UUID(event_type_id)
            recommended_service_types = db.query(EventTypeService.service_type_id).filter(
                EventTypeService.event_type_id == etid
            ).all()
            if recommended_service_types:
                st_ids = [r[0] for r in recommended_service_types]
                query = query.filter(UserService.service_type_id.in_(st_ids))
        except ValueError:
            pass

    if location:
        query = query.filter(UserService.location.ilike(f"%{location}%"))

    if min_price is not None:
        query = query.filter(UserService.min_price >= min_price)
    if max_price is not None:
        query = query.filter(UserService.min_price <= max_price)

    if available:
        query = query.filter(UserService.availability == "available")

    # Sort
    if sort_by == "rating":
        # Approximate rating sort since it's computed? Or join with ratings table?
        # For simplicity in this example, we assume we might store avg_rating on UserService or sort in python
        # Ideally, add a column `average_rating` to UserService and update it via triggers
        pass
    elif sort_by == "newest":
        query = query.order_by(UserService.created_at.desc())
    elif sort_by == "price_asc":
        query = query.order_by(UserService.min_price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(UserService.min_price.desc())

    # Pagination
    items, pagination = paginate(query, page, limit)

    result = []
    for s in items:
        # Calculate rating
        ratings = s.ratings
        avg = sum(r.rating for r in ratings) / len(ratings) if ratings else 0
        
        primary_image = None
        for img in s.images:
            if img.is_featured:
                primary_image = img.image_url
                break
        if not primary_image and s.images:
            primary_image = s.images[0].image_url

        result.append({
            "id": str(s.id),
            "title": s.title,
            "description": s.description[:100] + "...",
            "provider": {
                "id": str(s.user.id),
                "name": f"{s.user.first_name} {s.user.last_name}",
                "avatar": s.user.profile.profile_picture_url if s.user.profile else None,
                "verified": s.user.is_identity_verified
            },
            "category_name": s.category.name if s.category else None,
            "service_type_name": s.service_type.name if s.service_type else None,
            "min_price": float(s.min_price) if s.min_price else None,
            "max_price": float(s.max_price) if s.max_price else None,
            "currency": "TZS", # Default
            "location": s.location,
            "primary_image": primary_image,
            "rating": round(avg, 1),
            "review_count": len(ratings),
            "verified": s.is_verified,
            "created_at": s.created_at.isoformat()
        })

    return standard_response(True, "Services retrieved successfully", {"services": result, "pagination": pagination})


# =============================================================================
# 9.2 Get Single Service
# =============================================================================
@router.get("/{service_id}")
def get_service_details(service_id: str, db: Session = Depends(get_db)):
    """Returns detailed information about a service."""
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")

    ratings = service.ratings
    avg_rating = round(sum(r.rating for r in ratings) / len(ratings), 1) if ratings else 0
    
    images = [{"url": img.image_url, "is_featured": img.is_featured} for img in service.images]
    packages = [{"id": str(p.id), "name": p.name, "price": float(p.price), "features": p.features} for p in service.packages]
    
    # Reviews preview (top 3)
    reviews_preview = []
    for r in ratings[:3]:
        reviews_preview.append({
            "id": str(r.id),
            "user_name": f"{r.user.first_name} {r.user.last_name}" if r.user else "Anonymous",
            "rating": r.rating,
            "comment": r.review,
            "created_at": r.created_at.isoformat()
        })

    data = {
        "id": str(service.id),
        "title": service.title,
        "description": service.description,
        "provider": {
            "id": str(service.user.id),
            "name": f"{service.user.first_name} {service.user.last_name}",
            "avatar": service.user.profile.profile_picture_url if service.user.profile else None,
            "bio": service.user.profile.bio if service.user.profile else None,
            "location": service.user.profile.location if service.user.profile else None,
            "verified": service.user.is_identity_verified
        },
        "category": service.category.name if service.category else None,
        "service_type": service.service_type.name if service.service_type else None,
        "min_price": float(service.min_price) if service.min_price else None,
        "max_price": float(service.max_price) if service.max_price else None,
        "currency": "TZS",
        "location": service.location,
        "service_areas": service.service_areas if hasattr(service, "service_areas") else [],
        "images": images,
        "rating": avg_rating,
        "review_count": len(ratings),
        "verified": service.is_verified,
        "availability": service.availability.value if hasattr(service.availability, "value") else service.availability,
        "packages": packages,
        "reviews_preview": reviews_preview,
        "created_at": service.created_at.isoformat()
    }

    return standard_response(True, "Service retrieved successfully", data)


# =============================================================================
# 9.3 Get Service Reviews
# =============================================================================
@router.get("/{service_id}/reviews")
def get_service_reviews(
    service_id: str,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Returns reviews for a service."""
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    query = db.query(UserServiceRating).filter(UserServiceRating.user_service_id == sid).order_by(UserServiceRating.created_at.desc())
    items, pagination = paginate(query, page, limit)

    reviews = []
    for r in items:
        reviews.append({
            "id": str(r.id),
            "user_name": f"{r.user.first_name} {r.user.last_name}" if r.user else "Anonymous",
            "user_avatar": r.user.profile.profile_picture_url if r.user and r.user.profile else None,
            "rating": r.rating,
            "comment": r.review,
            "helpful_count": r.helpful_count,
            "created_at": r.created_at.isoformat()
        })

    return standard_response(True, "Reviews retrieved successfully", {"reviews": reviews, "pagination": pagination})


# =============================================================================
# 3.8 GET /recommendations/{event_type_id}
# =============================================================================
@router.get("/recommendations/{event_type_id}")
def get_event_recommendations(event_type_id: str, db: Session = Depends(get_db)):
    """
    Fetch recommended services for a given event type.
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
