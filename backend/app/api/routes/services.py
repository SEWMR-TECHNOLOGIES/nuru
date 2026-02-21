from datetime import datetime
import json
import math
import os
import re
import uuid
from typing import List, Optional

import pytz
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, or_, case, literal

from core.database import get_db
from models import (
    EventTypeService, EventService, Event, EventInvitation, EventCommitteeMember,
    ServiceType, UserService, ServicePackage, UserServiceRating
)
from utils.auth import get_current_user

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
# Helper: Personalized ranking score
# =============================================================================
def _compute_relevance_score(service, user_event_type_ids=None, user_lat=None, user_lng=None):
    """
    Multi-factor scoring algorithm for service ranking:
    Score = W1(Rating) + W2(Reviews) + W3(EventMatch) + W4(Proximity) + W5(Verified) + W6(Completeness)
    """
    score = 0.0

    # W1: Rating quality (0-25 pts)
    avg_rating = 0
    if service.ratings:
        avg_rating = sum(r.rating for r in service.ratings) / len(service.ratings)
    score += (avg_rating / 5.0) * 25

    # W2: Social proof - review volume (0-20 pts, log scale)
    review_count = len(service.ratings) if service.ratings else 0
    if review_count > 0:
        score += min(math.log(review_count + 1, 10) * 10, 20)

    # W3: Event type match - boost services matching user's event types (0-20 pts)
    if user_event_type_ids and service.service_type_id:
        # Check if this service type is recommended for user's event types
        # We pass pre-computed matching service_type_ids
        if str(service.service_type_id) in user_event_type_ids:
            score += 20

    # W4: Location proximity (0-15 pts)
    if user_lat and user_lng and service.latitude and service.longitude:
        dist = _haversine(user_lat, user_lng, float(service.latitude), float(service.longitude))
        if dist <= 10:
            score += 15
        elif dist <= 25:
            score += 12
        elif dist <= 50:
            score += 8
        elif dist <= 100:
            score += 4

    # W5: Verification trust (0-10 pts)
    if service.is_verified and service.verification_status == "verified":
        score += 10

    # W6: Profile completeness (0-10 pts)
    completeness = 0
    if service.description and len(service.description) > 50:
        completeness += 2
    if service.images and len(service.images) > 0:
        completeness += 3
    if service.min_price:
        completeness += 2
    if service.packages and len(service.packages) > 0:
        completeness += 3
    score += completeness

    return score


def _haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two lat/lng points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# =============================================================================
# 9.1 Search Services (Smart Ranking)
# =============================================================================
@router.get("/")
def search_services(
    request: Request,
    q: str = None,
    category_id: str = None,
    service_type_id: str = None,
    event_type_id: str = None,
    location: str = None,
    min_price: float = None,
    max_price: float = None,
    available: bool = False,
    sort_by: str = "relevance",
    lat: float = None,
    lng: float = None,
    radius_km: float = 100,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Searches, filters, and ranks public service listings.
    Uses a multi-factor relevance algorithm when sort_by=relevance.
    Supports geo-proximity when lat/lng provided.
    """

    query = db.query(UserService).filter(
        UserService.is_active == True,
        UserService.is_verified == True,
        UserService.verification_status == "verified"
    )

    if q:
        search = f"%{q}%"
        query = query.filter(or_(UserService.title.ilike(search), UserService.description.ilike(search)))

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

    # When event_type_id is set, treat location as a soft preference (used for ranking)
    # rather than a hard filter, so we always return relevant services.
    if location and not event_type_id:
        query = query.filter(UserService.location.ilike(f"%{location}%"))

    if min_price is not None:
        query = query.filter(UserService.min_price >= min_price)
    if max_price is not None:
        query = query.filter(UserService.min_price <= max_price)

    if available:
        query = query.filter(UserService.availability == "available")

    # ── Determine user context for personalized ranking ──
    user_event_type_service_ids = set()
    current_user = None
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            from utils.auth import decode_token
            token = auth_header.split(" ")[1]
            payload = decode_token(token)
            if payload:
                from models import User
                current_user = db.query(User).filter(User.id == payload.get("user_id")).first()
    except Exception:
        pass

    if current_user and sort_by == "relevance":
        # Get event types from user's events, invitations, and committee memberships
        user_event_type_ids_raw = set()

        # User's own events
        own_events = db.query(Event.event_type_id).filter(Event.organizer_id == current_user.id).distinct().all()
        for e in own_events:
            if e[0]:
                user_event_type_ids_raw.add(str(e[0]))

        # Events user is invited to
        invited = db.query(Event.event_type_id).join(
            EventInvitation, EventInvitation.event_id == Event.id
        ).filter(EventInvitation.user_id == current_user.id).distinct().all()
        for e in invited:
            if e[0]:
                user_event_type_ids_raw.add(str(e[0]))

        # Events user is committee member of
        committee = db.query(Event.event_type_id).join(
            EventCommitteeMember, EventCommitteeMember.event_id == Event.id
        ).filter(EventCommitteeMember.user_id == current_user.id).distinct().all()
        for e in committee:
            if e[0]:
                user_event_type_ids_raw.add(str(e[0]))

        # Map event types -> recommended service type IDs
        if user_event_type_ids_raw:
            recommended = db.query(EventTypeService.service_type_id).filter(
                EventTypeService.event_type_id.in_([uuid.UUID(x) for x in user_event_type_ids_raw])
            ).all()
            user_event_type_service_ids = {str(r[0]) for r in recommended}

    # ── Fetch all matching services for ranking ──
    # For relevance sorting, we fetch a larger pool and rank in-memory
    if sort_by == "relevance":
        all_services = query.all()

        # Score each service
        scored = []
        for s in all_services:
            score = _compute_relevance_score(
                s,
                user_event_type_ids=user_event_type_service_ids if user_event_type_service_ids else None,
                user_lat=lat,
                user_lng=lng
            )
            # Boost services whose location text matches the search location
            if location and s.location and location.lower() in s.location.lower():
                score += 15
            scored.append((s, score))

        # Sort by score descending, then by created_at for stability
        scored.sort(key=lambda x: (-x[1], x[0].created_at))

        total = len(scored)
        start = (page - 1) * limit
        end = start + limit
        page_items = [s for s, _ in scored[start:end]]

        total_pages = math.ceil(total / limit) if limit > 0 else 1
        pagination = {
            "page": page,
            "limit": limit,
            "total_items": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
        items = page_items
    else:
        # Standard sorting
        if sort_by == "newest":
            query = query.order_by(UserService.created_at.desc())
        elif sort_by == "price_low":
            query = query.order_by(UserService.min_price.asc().nullslast())
        elif sort_by == "price_high":
            query = query.order_by(UserService.min_price.desc().nullslast())
        elif sort_by == "rating":
            query = query.order_by(UserService.created_at.desc())  # fallback, rating computed
        elif sort_by == "reviews":
            query = query.order_by(UserService.created_at.desc())  # fallback
        else:
            query = query.order_by(UserService.created_at.desc())

        items, pagination = paginate(query, page, limit)

    # ── Build response ──
    # Collect location & price stats for filters
    all_locations = {}
    global_min_price = None
    global_max_price = None

    result = []
    for s in items:
        ratings = s.ratings
        avg = sum(r.rating for r in ratings) / len(ratings) if ratings else 0

        primary_image = None
        for img in s.images:
            if img.is_featured:
                primary_image = img.image_url
                break
        if not primary_image and s.images:
            primary_image = s.images[0].image_url

        loc = s.location or "Unknown"
        all_locations[loc] = all_locations.get(loc, 0) + 1

        if s.min_price:
            mp = float(s.min_price)
            if global_min_price is None or mp < global_min_price:
                global_min_price = mp
        if s.max_price:
            xp = float(s.max_price)
            if global_max_price is None or xp > global_max_price:
                global_max_price = xp

        result.append({
            "id": str(s.id),
            "title": s.title,
            "short_description": (s.description[:100] + "...") if s.description and len(s.description) > 100 else s.description,
            "description": s.description,
            "provider": {
                "id": str(s.user.id),
                "name": f"{s.user.first_name} {s.user.last_name}",
                "avatar": s.user.profile.profile_picture_url if s.user.profile else None,
                "verified": s.user.is_identity_verified
            },
            "service_category": {
                "id": str(s.category.id) if s.category else None,
                "name": s.category.name if s.category else None,
            },
            "service_type": {
                "id": str(s.service_type.id) if s.service_type else None,
                "name": s.service_type.name if s.service_type else None,
            },
            "min_price": float(s.min_price) if s.min_price else None,
            "max_price": float(s.max_price) if s.max_price else None,
            "currency": "TZS",
            "location": s.location,
            "latitude": float(s.latitude) if s.latitude else None,
            "longitude": float(s.longitude) if s.longitude else None,
            "primary_image": primary_image,
            "images": [{"id": str(img.id), "url": img.image_url, "is_primary": img.is_featured} for img in (s.images or [])],
            "rating": round(avg, 1),
            "review_count": len(ratings),
            "verification_status": s.verification_status if hasattr(s, "verification_status") else "unverified",
            "verified": s.is_verified,
            "availability": s.availability.value if hasattr(s.availability, "value") else s.availability,
            "years_experience": getattr(s, "years_experience", None),
            "completed_events": getattr(s, "completed_events", None),
            "business_phone": {
                "phone_number": s.business_phone.phone_number,
                "verification_status": s.business_phone.verification_status.value if hasattr(s.business_phone.verification_status, "value") else str(s.business_phone.verification_status),
            } if s.business_phone else None,
            "created_at": s.created_at.isoformat()
        })

    # Build dynamic filter data
    filters = {
        "categories": [],  # Already handled by frontend via references API
        "locations": [{"name": k, "count": v} for k, v in sorted(all_locations.items())],
        "price_range": {
            "min": global_min_price or 0,
            "max": global_max_price or 10000000,
            "currency": "TZS"
        }
    }

    return standard_response(True, "Services retrieved successfully", {
        "services": result,
        "filters": filters,
        "pagination": pagination
    })


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
            "user_avatar": r.user.profile.profile_picture_url if r.user and r.user.profile else None,
            "rating": r.rating,
            "comment": r.review,
            "created_at": r.created_at.isoformat()
        })

    # Count completed events for this service
    completed_events = db.query(sa_func.count(EventService.id)).filter(
        EventService.provider_user_service_id == sid,
        EventService.service_status == "completed",
    ).scalar() or 0

    owner_name = f"{service.user.first_name} {service.user.last_name}".strip()
    owner_avatar = service.user.profile.profile_picture_url if service.user and service.user.profile else None

    data = {
        "id": str(service.id),
        "title": service.title,
        "description": service.description,
        "short_description": (service.description[:120] + "…") if service.description and len(service.description) > 120 else service.description,
        "provider": {
            "id": str(service.user.id),
            "name": owner_name,
            "avatar": owner_avatar,
            "bio": service.user.profile.bio if service.user.profile else None,
            "location": service.user.profile.location if service.user.profile else None,
            "verified": service.user.is_identity_verified
        },
        "owner_name": owner_name,
        "owner_avatar": owner_avatar,
        "user_id": str(service.user.id),
        "service_category": {"name": service.category.name} if service.category else None,
        "category": service.category.name if service.category else None,
        "service_type": service.service_type.name if service.service_type else None,
        "min_price": float(service.min_price) if service.min_price else None,
        "max_price": float(service.max_price) if service.max_price else None,
        "currency": "TZS",
        "location": service.location,
        "latitude": float(service.latitude) if service.latitude else None,
        "longitude": float(service.longitude) if service.longitude else None,
        "formatted_address": service.formatted_address,
        "service_areas": service.service_areas if hasattr(service, "service_areas") else [],
        "images": images,
        "rating": avg_rating,
        "review_count": len(ratings),
        "verified": service.is_verified,
        "is_verified": service.is_verified,
        "verification_status": service.verification_status.value if hasattr(service.verification_status, "value") else str(service.verification_status) if service.verification_status else None,
        "availability": service.availability.value if hasattr(service.availability, "value") else service.availability,
        "years_experience": service.years_experience if hasattr(service, "years_experience") else 0,
        "completed_events": completed_events,
        "packages": packages,
        "reviews_preview": reviews_preview,
        "intro_media": [
            {
                "id": str(m.id),
                "media_type": m.media_type.value if hasattr(m.media_type, "value") else str(m.media_type),
                "media_url": m.media_url,
            } for m in (service.intro_media or [])
        ],
        "business_phone": {
            "phone_number": service.business_phone.phone_number,
            "verification_status": service.business_phone.verification_status.value if hasattr(service.business_phone.verification_status, "value") else str(service.business_phone.verification_status),
        } if service.business_phone else None,
        "is_owner": False,
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


# =============================================================================
# Service Calendar - Dynamic event assignments
# =============================================================================
@router.get("/{service_id}/calendar")
def get_service_calendar(
    service_id: str,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    """Returns booked dates for a service provider based on actual event assignments."""
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")

    query = db.query(EventService).filter(
        EventService.provider_user_service_id == sid
    )

    event_assignments = query.all()

    booked_dates = []
    for es in event_assignments:
        event = db.query(Event).filter(Event.id == es.event_id).first()
        if not event or not event.start_date:
            continue

        event_date = event.start_date
        if hasattr(event_date, 'date'):
            event_date_str = event_date.strftime("%Y-%m-%d")
        else:
            event_date_str = str(event_date)[:10]

        status = es.service_status.value if hasattr(es.service_status, "value") else str(es.service_status)

        show_price = float(es.agreed_price) if es.agreed_price and status in ("confirmed", "completed", "accepted") else None

        booked_dates.append({
            "date": event_date_str,
            "event_id": str(event.id),
            "event_name": event.name or "Event",
            "event_location": event.location,
            "status": status,
            "agreed_price": show_price,
        })

    return standard_response(True, "Calendar data retrieved", {
        "service_id": str(sid),
        "booked_dates": booked_dates,
    })


# =============================================================================
# 9.4 Submit Service Review (Authenticated)
# =============================================================================
@router.post("/{service_id}/reviews")
async def submit_service_review(
    service_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: "User" = Depends(get_current_user),
):
    """
    Submit a review for a service. Only users whose events were served by this
    provider can leave a review, and only once per service.
    """

    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")

    if str(service.user_id) == str(current_user.id):
        return standard_response(False, "You cannot review your own service")

    eligible = (
        db.query(EventService)
        .join(Event, Event.id == EventService.event_id)
        .filter(
            EventService.provider_user_service_id == sid,
            Event.organizer_id == current_user.id,
            EventService.service_status.in_(["assigned", "in_progress", "completed"]),
        )
        .first()
    )

    if not eligible:
        return standard_response(
            False,
            "You can only review services that were assigned to your events",
        )

    existing = db.query(UserServiceRating).filter(
        UserServiceRating.user_service_id == sid,
        UserServiceRating.user_id == current_user.id,
    ).first()

    if existing:
        return standard_response(False, "You have already reviewed this service")

    try:
        body = await request.json()
    except Exception:
        return standard_response(False, "Invalid JSON body")

    rating = body.get("rating")
    comment = body.get("comment", "").strip()

    if rating is None:
        return standard_response(False, "Rating is required")

    try:
        rating = int(rating)
    except (ValueError, TypeError):
        return standard_response(False, "Rating must be a number between 1 and 5")

    if not (1 <= rating <= 5):
        return standard_response(False, "Rating must be between 1 and 5")

    review = UserServiceRating(
        id=uuid.uuid4(),
        user_service_id=sid,
        user_id=current_user.id,
        rating=rating,
        review=comment,
        created_at=datetime.now(EAT),
    )
    db.add(review)
    db.commit()

    return standard_response(True, "Review submitted successfully", {
        "id": str(review.id),
        "rating": review.rating,
        "comment": review.review,
        "created_at": review.created_at.isoformat()
    })
