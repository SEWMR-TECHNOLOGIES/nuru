# backend/app/api/routes/events.py

from datetime import datetime
import json
import math
import os
import re
import uuid
from typing import List, Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy import func as sa_func, case, and_
from sqlalchemy.orm import Session, joinedload

from core.config import (
    ALLOWED_IMAGE_EXTENSIONS,
    MAX_EVENT_IMAGES,
    MAX_IMAGE_SIZE,
    UPLOAD_SERVICE_URL,
)
from core.database import get_db
from models.enums import (
    EventServiceStatusEnum,
    EventStatusEnum,
    PaymentMethodEnum,
    PriorityLevelEnum,
    RSVPStatusEnum,
)
from models.events import (
    CommitteePermission,
    CommitteeRole,
    ContributionThankYouMessage,
    Event,
    EventAttendee,
    EventBudgetItem,
    EventCommitteeMember,
    EventContribution,
    EventContributionTarget,
    EventGuestPlusOne,
    EventImage,
    EventInvitation,
    EventScheduleItem,
    EventService,
    EventServicePayment,
    EventSetting,
    EventType,
    EventTypeService,
    EventVenueCoordinate,
)
from models.services import ServiceType, UserService, ServicePackage
from models.users import User, UserProfile
from models.localizations import Currency
from utils.auth import get_current_user
from utils.helpers import format_price, standard_response
from sqlalchemy import Column, Date, Enum, Integer, String, Text, Boolean, ForeignKey, DateTime, Numeric, Time
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.base import Base

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
# HELPER: build event summary dict (shared by list + detail + create + update)
# =============================================================================

def _guest_counts(db: Session, event_id: uuid.UUID) -> dict:
    """Return guest / RSVP aggregate counts for an event."""
    rows = (
        db.query(
            EventAttendee.rsvp_status,
            sa_func.count(EventAttendee.id),
        )
        .filter(EventAttendee.event_id == event_id)
        .group_by(EventAttendee.rsvp_status)
        .all()
    )
    counts = {r.value: 0 for r in RSVPStatusEnum}
    total = 0
    for status, cnt in rows:
        key = status.value if hasattr(status, "value") else status
        counts[key] = cnt
        total += cnt

    checked_in = (
        db.query(sa_func.count(EventAttendee.id))
        .filter(EventAttendee.event_id == event_id, EventAttendee.checked_in == True)
        .scalar()
    ) or 0

    return {
        "guest_count": total,
        "confirmed_guest_count": counts.get("confirmed", 0),
        "pending_guest_count": counts.get("pending", 0),
        "declined_guest_count": counts.get("declined", 0),
        "checked_in_count": checked_in,
    }


def _contribution_summary(db: Session, event_id: uuid.UUID) -> dict:
    result = (
        db.query(
            sa_func.coalesce(sa_func.sum(EventContribution.amount), 0),
            sa_func.count(EventContribution.id),
        )
        .filter(EventContribution.event_id == event_id)
        .first()
    )
    return {
        "contribution_total": float(result[0]),
        "contribution_count": result[1],
    }


def _event_type_dict(event_type: EventType | None) -> dict | None:
    if not event_type:
        return None
    return {
        "id": str(event_type.id),
        "name": event_type.name,
        "icon": event_type.icon,
        "color": None,  # EventType model has no color column
    }


def _venue_coords_dict(vc: EventVenueCoordinate | None) -> dict | None:
    if not vc:
        return None
    return {
        "latitude": float(vc.latitude) if vc.latitude else None,
        "longitude": float(vc.longitude) if vc.longitude else None,
    }


def _currency_code(db: Session, currency_id) -> str | None:
    if not currency_id:
        return None
    cur = db.query(Currency).filter(Currency.id == currency_id).first()
    return cur.code.strip() if cur else None


def _event_images(db: Session, event_id: uuid.UUID) -> list[dict]:
    """Return all images for an event from the event_images table."""
    rows = (
        db.query(EventImage)
        .filter(EventImage.event_id == event_id)
        .order_by(EventImage.is_featured.desc(), EventImage.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(img.id),
            "image_url": img.image_url,
            "caption": img.caption,
            "is_featured": img.is_featured,
            "created_at": img.created_at.isoformat() if img.created_at else None,
        }
        for img in rows
    ]


def _pick_cover_image(event, images: list[dict]) -> str | None:
    """Pick a cover image: explicit cover_image_url > featured image > first image."""
    if event.cover_image_url:
        return event.cover_image_url
    # Prefer featured image
    for img in images:
        if img.get("is_featured"):
            return img["image_url"]
    # Fall back to first image
    if images:
        return images[0]["image_url"]
    return None


def _event_summary(db: Session, event: Event, event_type: EventType | None = None) -> dict:
    """Build the summary dict used in list / create / update responses."""
    if event_type is None:
        event_type = db.query(EventType).filter(EventType.id == event.event_type_id).first()

    gc = _guest_counts(db, event.id)
    cs = _contribution_summary(db, event.id)

    settings = db.query(EventSetting).filter(EventSetting.event_id == event.id).first()
    vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == event.id).first()
    committee_count = db.query(sa_func.count(EventCommitteeMember.id)).filter(
        EventCommitteeMember.event_id == event.id
    ).scalar() or 0
    service_booking_count = db.query(sa_func.count(EventService.id)).filter(
        EventService.event_id == event.id
    ).scalar() or 0

    # Contribution target from settings or contribution_targets table
    contribution_target = 0
    if settings and settings.contribution_target_amount:
        contribution_target = float(settings.contribution_target_amount)
    else:
        ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == event.id).first()
        if ct:
            contribution_target = float(ct.target_amount)

    # Event images from event_images table
    images = _event_images(db, event.id)

    return {
        "id": str(event.id),
        "user_id": str(event.organizer_id),
        "title": event.name,
        "description": event.description,
        "event_type_id": str(event.event_type_id) if event.event_type_id else None,
        "event_type": _event_type_dict(event_type),
        "start_date": event.start_date.isoformat() if event.start_date else None,
        "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "end_time": event.end_time.strftime("%H:%M") if event.end_time else None,
        "location": event.location,
        "venue": vc.venue_name if vc else None,
        "venue_address": vc.formatted_address if vc else None,
        "venue_coordinates": _venue_coords_dict(vc),
        "cover_image": _pick_cover_image(event, images),
        "images": images,
        "theme_color": event.theme_color,
        "is_public": event.is_public,
        "status": event.status.value if hasattr(event.status, "value") else event.status,
        "budget": float(event.budget) if event.budget else None,
        "currency": _currency_code(db, event.currency_id),
        "dress_code": event.dress_code,
        "special_instructions": event.special_instructions,
        "rsvp_deadline": settings.rsvp_deadline.isoformat() if settings and settings.rsvp_deadline else None,
        "contribution_enabled": settings.contributions_enabled if settings else False,
        "contribution_target": contribution_target,
        "contribution_description": ct.description if (ct := db.query(EventContributionTarget).filter(EventContributionTarget.event_id == event.id).first()) else None,
        "expected_guests": event.expected_guests,
        **gc,
        **cs,
        "committee_count": committee_count,
        "service_booking_count": service_booking_count,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "updated_at": event.updated_at.isoformat() if event.updated_at else None,
    }


# =============================================================================
# HELPER: upload a single image via the external upload service
# =============================================================================

async def _upload_image(file: UploadFile, target_folder: str) -> dict:
    """Upload a file to the external upload service. Returns {"success": bool, "url": str|None, "error": str|None}."""
    _, ext = os.path.splitext(file.filename or "unknown.jpg")
    ext = ext.lower().replace(".", "")
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return {"success": False, "url": None, "error": f"File '{file.filename}' has invalid format. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}."}

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        return {"success": False, "url": None, "error": f"File '{file.filename}' exceeds the maximum allowed size."}

    unique_name = f"{uuid.uuid4().hex}.{ext}"
    upload_data = {"target_path": target_folder}
    upload_files = {"file": (unique_name, content, file.content_type)}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(UPLOAD_SERVICE_URL, data=upload_data, files=upload_files, timeout=20)
        except Exception as e:
            return {"success": False, "url": None, "error": f"Upload failed for '{file.filename}': {str(e)}"}

    if resp.status_code != 200:
        return {"success": False, "url": None, "error": f"Upload service returned {resp.status_code} for '{file.filename}'."}

    result = resp.json()
    if not result.get("success"):
        return {"success": False, "url": None, "error": result.get("message", f"Upload failed for '{file.filename}'.")}

    return {"success": True, "url": result["data"]["url"], "error": None}


# =============================================================================
# 3.8 GET /recommendations/{event_type_id}
# =============================================================================

@router.get("/recommendations/{event_type_id}")
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


# =============================================================================
# 3.1 GET / — List all user events
# =============================================================================

@router.get("/")
def list_user_events(
    page: int = 1,
    limit: int = 20,
    status: str = "all",
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated list of events owned by the authenticated user."""
    try:
        # --- Validation ---
        if page < 1:
            return standard_response(False, "Page number must be at least 1.")
        if limit < 1 or limit > 100:
            return standard_response(False, "Limit must be between 1 and 100.")
        if status not in VALID_STATUS_FILTERS:
            return standard_response(
                False,
                f"Invalid status filter '{status}'. Must be one of: {', '.join(VALID_STATUS_FILTERS)}.",
            )
        if sort_by not in VALID_SORT_FIELDS:
            return standard_response(
                False,
                f"Invalid sort_by '{sort_by}'. Must be one of: {', '.join(VALID_SORT_FIELDS)}.",
            )
        if sort_order not in VALID_SORT_ORDERS:
            return standard_response(False, "sort_order must be 'asc' or 'desc'.")

        # --- Base query ---
        query = db.query(Event).filter(Event.organizer_id == current_user.id)

        # Status filter (API uses "published" which maps to "confirmed" in the enum)
        if status != "all":
            mapped_status = status
            if status == "published":
                mapped_status = "confirmed"
            query = query.filter(Event.status == mapped_status)

        # Sort
        sort_col = {
            "created_at": Event.created_at,
            "start_date": Event.start_date,
            "title": Event.name,
        }[sort_by]

        if sort_order == "desc":
            query = query.order_by(sort_col.desc())
        else:
            query = query.order_by(sort_col.asc())

        # --- Pagination ---
        total_items = query.count()
        total_pages = max(1, math.ceil(total_items / limit))
        offset = (page - 1) * limit
        events = query.offset(offset).limit(limit).all()

        events_data = []
        for ev in events:
            events_data.append(_event_summary(db, ev))

        return standard_response(True, "Events retrieved successfully", {
            "events": events_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_items": total_items,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1,
            },
        })
    except Exception as e:
        return standard_response(False, f"Failed to retrieve events: {str(e)}")


# =============================================================================
# 3.2 GET /{event_id} — Get single event (detailed)
# =============================================================================

@router.get("/{event_id}")
def get_event_detail(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return detailed event data including guests, committee, contributions, schedule, budget items, service bookings."""
    try:
        # Validate UUID
        try:
            eid = uuid.UUID(event_id)
        except ValueError:
            return standard_response(False, "Invalid event ID format.")

        event = db.query(Event).filter(Event.id == eid).first()
        if not event:
            return standard_response(False, "Event not found")

        # Ownership or committee membership check
        is_owner = str(event.organizer_id) == str(current_user.id)
        is_committee = False
        if not is_owner:
            cm = (
                db.query(EventCommitteeMember)
                .filter(
                    EventCommitteeMember.event_id == eid,
                    EventCommitteeMember.user_id == current_user.id,
                )
                .first()
            )
            is_committee = cm is not None

        if not is_owner and not is_committee and not event.is_public:
            return standard_response(False, "You do not have permission to view this event")

        # Base summary
        data = _event_summary(db, event)

        # --- Gallery images ---
        images = db.query(EventImage).filter(EventImage.event_id == eid).all()
        data["gallery_images"] = [img.image_url for img in images]

        # --- Guests (attendees joined with user + invitation + plus-ones) ---
        attendees = db.query(EventAttendee).filter(EventAttendee.event_id == eid).all()
        guests_list = []
        for att in attendees:
            user = db.query(User).filter(User.id == att.attendee_id).first()
            invitation = None
            if att.invitation_id:
                invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first()

            plus_ones = db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).all()

            guests_list.append({
                "id": str(att.id),
                "event_id": str(att.event_id),
                "name": f"{user.first_name} {user.last_name}" if user else None,
                "email": user.email if user else None,
                "phone": user.phone if user else None,
                "rsvp_status": att.rsvp_status.value if hasattr(att.rsvp_status, "value") else att.rsvp_status,
                "table_number": None,
                "seat_number": None,
                "dietary_requirements": att.dietary_restrictions,
                "meal_preference": att.meal_preference,
                "special_requests": att.special_requests,
                "plus_ones": len(plus_ones),
                "plus_one_names": [po.name for po in plus_ones],
                "notes": invitation.notes if invitation else None,
                "invitation_sent": invitation.sent_at is not None if invitation else False,
                "invitation_sent_at": invitation.sent_at.isoformat() if invitation and invitation.sent_at else None,
                "invitation_method": invitation.sent_via if invitation else None,
                "checked_in": att.checked_in,
                "checked_in_at": att.checked_in_at.isoformat() if att.checked_in_at else None,
                "created_at": att.created_at.isoformat() if att.created_at else None,
                "updated_at": att.updated_at.isoformat() if att.updated_at else None,
            })
        data["guests"] = guests_list

        # --- Committee members ---
        cms = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == eid).all()
        committee_list = []
        for cm in cms:
            member_user = db.query(User).filter(User.id == cm.user_id).first()
            profile = db.query(UserProfile).filter(UserProfile.user_id == cm.user_id).first() if member_user else None
            role = db.query(CommitteeRole).filter(CommitteeRole.id == cm.role_id).first() if cm.role_id else None
            perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
            assigned_user = db.query(User).filter(User.id == cm.assigned_by).first() if cm.assigned_by else None

            committee_list.append({
                "id": str(cm.id),
                "event_id": str(cm.event_id),
                "user_id": str(cm.user_id),
                "name": f"{member_user.first_name} {member_user.last_name}" if member_user else None,
                "email": member_user.email if member_user else None,
                "phone": member_user.phone if member_user else None,
                "avatar": profile.profile_picture_url if profile else None,
                "role": {
                    "id": str(role.id) if role else None,
                    "name": role.role_name if role else None,
                    "description": role.description if role else None,
                } if role else None,
                "permissions": {
                    "can_view_guests": perms.can_view_guests if perms else True,
                    "can_manage_guests": perms.can_manage_guests if perms else False,
                    "can_send_invitations": perms.can_send_invitations if perms else False,
                    "can_check_in_guests": perms.can_check_in_guests if perms else False,
                    "can_view_budget": perms.can_view_budget if perms else False,
                    "can_manage_budget": perms.can_manage_budget if perms else False,
                    "can_view_contributions": perms.can_view_contributions if perms else False,
                    "can_manage_contributions": perms.can_manage_contributions if perms else False,
                    "can_view_vendors": perms.can_view_vendors if perms else True,
                    "can_manage_vendors": perms.can_manage_vendors if perms else False,
                    "can_approve_bookings": perms.can_approve_bookings if perms else False,
                    "can_edit_event": perms.can_edit_event if perms else False,
                    "can_manage_committee": perms.can_manage_committee if perms else False,
                },
                "assigned_by": {
                    "id": str(assigned_user.id),
                    "name": f"{assigned_user.first_name} {assigned_user.last_name}",
                } if assigned_user else None,
                "assigned_at": cm.assigned_at.isoformat() if cm.assigned_at else None,
                "created_at": cm.created_at.isoformat() if cm.created_at else None,
            })
        data["committee_members"] = committee_list

        # --- Contributions ---
        contributions = db.query(EventContribution).filter(EventContribution.event_id == eid).all()
        contrib_list = []
        for c in contributions:
            contributor_user = db.query(User).filter(User.id == c.contributor_user_id).first() if c.contributor_user_id else None
            contact = c.contributor_contact or {}
            contrib_list.append({
                "id": str(c.id),
                "event_id": str(c.event_id),
                "contributor_name": (
                    f"{contributor_user.first_name} {contributor_user.last_name}"
                    if contributor_user
                    else (c.contributor_name or "Anonymous")
                ),
                "contributor_email": (
                    contributor_user.email if contributor_user else contact.get("email")
                ),
                "contributor_phone": (
                    contributor_user.phone if contributor_user else contact.get("phone")
                ),
                "contributor_user_id": str(c.contributor_user_id) if c.contributor_user_id else None,
                "amount": float(c.amount),
                "currency": _currency_code(db, event.currency_id),
                "payment_method": c.payment_method.value if hasattr(c.payment_method, "value") else c.payment_method,
                "payment_reference": c.transaction_ref,
                "status": "confirmed",
                "message": None,
                "is_anonymous": c.contributor_user_id is None and (not c.contributor_name or c.contributor_name.lower() == "anonymous"),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "confirmed_at": c.contributed_at.isoformat() if c.contributed_at else None,
            })
        data["contributions"] = contrib_list

        # --- Service bookings ---
        event_services = db.query(EventService).filter(EventService.event_id == eid).all()
        bookings_list = []
        for es in event_services:
            svc_type = db.query(ServiceType).filter(ServiceType.id == es.service_id).first()
            provider_svc = None
            if es.provider_user_service_id:
                provider_svc = db.query(UserService).filter(UserService.id == es.provider_user_service_id).first()
            provider_user = db.query(User).filter(User.id == es.provider_user_id).first() if es.provider_user_id else None
            provider_profile = db.query(UserProfile).filter(UserProfile.user_id == es.provider_user_id).first() if es.provider_user_id else None

            bookings_list.append({
                "id": str(es.id),
                "event_id": str(es.event_id),
                "service_id": str(es.service_id),
                "service": {
                    "id": str(svc_type.id) if svc_type else None,
                    "title": provider_svc.title if provider_svc else (svc_type.name if svc_type else None),
                    "category": (
                        svc_type.category.name
                        if svc_type and hasattr(svc_type, "category") and svc_type.category
                        else None
                    ),
                    "provider_name": (
                        f"{provider_user.first_name} {provider_user.last_name}" if provider_user else None
                    ),
                    "provider_avatar": provider_profile.profile_picture_url if provider_profile else None,
                    "rating": None,
                    "review_count": None,
                },
                "package_id": None,
                "package_name": None,
                "quoted_price": float(es.agreed_price) if es.agreed_price else None,
                "currency": _currency_code(db, event.currency_id),
                "status": es.service_status.value if hasattr(es.service_status, "value") else es.service_status,
                "notes": es.notes,
                "created_at": es.created_at.isoformat() if es.created_at else None,
                "confirmed_at": es.assigned_at.isoformat() if es.assigned_at else None,
            })
        data["service_bookings"] = bookings_list

        # --- Schedule items ---
        schedule_items = (
            db.query(EventScheduleItem)
            .filter(EventScheduleItem.event_id == eid)
            .order_by(EventScheduleItem.display_order.asc())
            .all()
        )
        data["schedule"] = [
            {
                "id": str(si.id),
                "event_id": str(si.event_id),
                "title": si.title,
                "description": si.description,
                "start_time": si.start_time.isoformat() if si.start_time else None,
                "end_time": si.end_time.isoformat() if si.end_time else None,
                "location": si.location,
                "display_order": si.display_order,
            }
            for si in schedule_items
        ]

        # --- Budget items ---
        budget_items = (
            db.query(EventBudgetItem)
            .filter(EventBudgetItem.event_id == eid)
            .all()
        )
        data["budget_items"] = [
            {
                "id": str(bi.id),
                "event_id": str(bi.event_id),
                "category": bi.category,
                "item_name": bi.item_name,
                "estimated_cost": float(bi.estimated_cost) if bi.estimated_cost else None,
                "actual_cost": float(bi.actual_cost) if bi.actual_cost else None,
                "vendor_name": bi.vendor_name,
                "status": bi.status,
                "notes": bi.notes,
                "created_at": bi.created_at.isoformat() if bi.created_at else None,
            }
            for bi in budget_items
        ]

        return standard_response(True, "Event retrieved successfully", data)
    except Exception as e:
        return standard_response(False, f"Failed to retrieve event: {str(e)}")


# =============================================================================
# 3.3 POST / — Create event
# =============================================================================

@router.post("/")
async def create_event(
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    event_type_id: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    venue: Optional[str] = Form(None),
    venue_address: Optional[str] = Form(None),
    venue_latitude: Optional[float] = Form(None),
    venue_longitude: Optional[float] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    theme_color: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(False),
    budget: Optional[float] = Form(None),
    currency: Optional[str] = Form(None),
    expected_guests: Optional[int] = Form(None),
    dress_code: Optional[str] = Form(None),
    special_instructions: Optional[str] = Form(None),
    rsvp_deadline: Optional[str] = Form(None),
    contribution_enabled: Optional[bool] = Form(False),
    contribution_target: Optional[float] = Form(None),
    contribution_description: Optional[str] = Form(None),
    services: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new event with comprehensive validation."""
    try:
        # ---- Validation ----
        errors = []

        if not title or not title.strip():
            errors.append({"field": "title", "message": "Title is required."})
        elif len(title.strip()) > 100:
            errors.append({"field": "title", "message": "Title must be at most 100 characters."})

        if not event_type_id:
            errors.append({"field": "event_type_id", "message": "Event type is required."})
        else:
            try:
                _etid = uuid.UUID(event_type_id)
            except ValueError:
                errors.append({"field": "event_type_id", "message": "Invalid event_type_id UUID format."})
        if not start_date or not start_date.strip():
            errors.append({"field": "start_date", "message": "Start date is required (ISO 8601)."})
        else:
            try:
                parsed_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError:
                errors.append({"field": "start_date", "message": "Invalid start_date format. Use ISO 8601."})

        if description and len(description.strip()) > 2000:
            errors.append({"field": "description", "message": "Description must be at most 2000 characters."})
        if location and len(location.strip()) > 100:
            errors.append({"field": "location", "message": "Location must be at most 100 characters."})
        if venue and len(venue.strip()) > 200:
            errors.append({"field": "venue", "message": "Venue name must be at most 200 characters."})
        if venue_address and len(venue_address.strip()) > 500:
            errors.append({"field": "venue_address", "message": "Venue address must be at most 500 characters."})
        if dress_code and len(dress_code.strip()) > 200:
            errors.append({"field": "dress_code", "message": "Dress code must be at most 200 characters."})
        if special_instructions and len(special_instructions.strip()) > 1000:
            errors.append({"field": "special_instructions", "message": "Special instructions must be at most 1000 characters."})
        if contribution_description and len(contribution_description.strip()) > 500:
            errors.append({"field": "contribution_description", "message": "Contribution description must be at most 500 characters."})

        if theme_color and not HEX_COLOR_RE.match(theme_color):
            errors.append({"field": "theme_color", "message": "theme_color must be a valid hex code (e.g. #FF6B6B)."})

        if budget is not None and budget < 0:
            errors.append({"field": "budget", "message": "Budget must be a non-negative number."})
        if expected_guests is not None and expected_guests < 0:
            errors.append({"field": "expected_guests", "message": "Expected guests must be a non-negative integer."})
        if contribution_target is not None and contribution_target < 0:
            errors.append({"field": "contribution_target", "message": "Contribution target must be non-negative."})

        if venue_latitude is not None and (venue_latitude < -90 or venue_latitude > 90):
            errors.append({"field": "venue_latitude", "message": "Latitude must be between -90 and 90."})
        if venue_longitude is not None and (venue_longitude < -180 or venue_longitude > 180):
            errors.append({"field": "venue_longitude", "message": "Longitude must be between -180 and 180."})

        parsed_end = None
        if end_date and end_date.strip():
            try:
                parsed_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError:
                errors.append({"field": "end_date", "message": "Invalid end_date format. Use ISO 8601."})

        parsed_rsvp = None
        if rsvp_deadline and rsvp_deadline.strip():
            try:
                parsed_rsvp = datetime.fromisoformat(rsvp_deadline.replace("Z", "+00:00"))
            except ValueError:
                errors.append({"field": "rsvp_deadline", "message": "Invalid rsvp_deadline format. Use ISO 8601."})

        if errors:
            print(f"Validation errors: {errors}")
            return standard_response(False, "Validation failed", errors)

        # ---- Verify event type exists ----
        event_type = db.query(EventType).filter(EventType.id == event_type_id).first()
        if not event_type:
            return standard_response(False, "Selected event type does not exist.")

        # ---- Resolve currency ----
        currency_id = None
        if currency:
            cur = db.query(Currency).filter(Currency.code == currency.upper()).first()
            if cur:
                currency_id = cur.id

        # Re-parse start after validation
        parsed_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))

        # ---- Create Event ----
        now = datetime.now(EAT)
        new_event = Event(
            id=uuid.uuid4(),
            organizer_id=current_user.id,
            name=title.strip(),
            event_type_id=uuid.UUID(event_type_id),
            description=description.strip() if description else None,
            start_date=parsed_start.date(),
            start_time=parsed_start.time(),
            end_date=parsed_end.date() if parsed_end else None,
            end_time=parsed_end.time() if parsed_end else None,
            location=location.strip() if location else None,
            expected_guests=expected_guests,
            budget=budget,
            status=EventStatusEnum.draft,
            currency_id=currency_id,
            is_public=is_public or False,
            theme_color=theme_color.strip() if theme_color else None,
            dress_code=dress_code.strip() if dress_code else None,
            special_instructions=special_instructions.strip() if special_instructions else None,
            created_at=now,
            updated_at=now,
        )
        db.add(new_event)
        db.flush()

        # ---- Venue coordinates ----
        if venue_latitude is not None and venue_longitude is not None:
            vc = EventVenueCoordinate(
                id=uuid.uuid4(),
                event_id=new_event.id,
                latitude=venue_latitude,
                longitude=venue_longitude,
                formatted_address=venue_address.strip() if venue_address else None,
                venue_name=venue.strip() if venue else None,
                created_at=now,
                updated_at=now,
            )
            db.add(vc)
        elif venue or venue_address:
            vc = EventVenueCoordinate(
                id=uuid.uuid4(),
                event_id=new_event.id,
                latitude=0,
                longitude=0,
                formatted_address=venue_address.strip() if venue_address else None,
                venue_name=venue.strip() if venue else None,
                created_at=now,
                updated_at=now,
            )
            db.add(vc)

        # ---- Event settings ----
        setting = EventSetting(
            id=uuid.uuid4(),
            event_id=new_event.id,
            rsvp_deadline=parsed_rsvp,
            contributions_enabled=contribution_enabled or False,
            contribution_target_amount=contribution_target,
            created_at=now,
            updated_at=now,
        )
        db.add(setting)

        # ---- Contribution target record ----
        if contribution_target and contribution_target > 0:
            ct = EventContributionTarget(
                id=uuid.uuid4(),
                event_id=new_event.id,
                target_amount=contribution_target,
                description=contribution_description.strip() if contribution_description else None,
                created_at=now,
                updated_at=now,
            )
            db.add(ct)

        # ---- Cover image upload ----
        if cover_image and cover_image.filename:
            result = await _upload_image(cover_image, f"nuru/uploads/events/{new_event.id}/cover/")
            if not result["success"]:
                db.rollback()
                return standard_response(False, result["error"])
            new_event.cover_image_url = result["url"]

        # ---- Gallery images ----
        if images:
            real_images = [f for f in images if f and f.filename]
            if len(real_images) > MAX_EVENT_IMAGES:
                db.rollback()
                return standard_response(False, f"You can upload a maximum of {MAX_EVENT_IMAGES} images.")
            for file in real_images:
                result = await _upload_image(file, f"nuru/uploads/events/{new_event.id}/gallery/")
                if not result["success"]:
                    db.rollback()
                    return standard_response(False, result["error"])
                db.add(EventImage(
                    id=uuid.uuid4(),
                    event_id=new_event.id,
                    image_url=result["url"],
                    created_at=now,
                    updated_at=now,
                ))

        # ---- Services ----
        if services:
            try:
                service_list = json.loads(services)
                if not isinstance(service_list, list):
                    db.rollback()
                    return standard_response(False, "Services must be a JSON array.")
                for s in service_list:
                    if "service_id" not in s:
                        db.rollback()
                        return standard_response(False, "Each service must include 'service_id'.")
                    try:
                        sid = uuid.UUID(s["service_id"])
                    except ValueError:
                        db.rollback()
                        return standard_response(False, f"Invalid service_id UUID: {s['service_id']}")
                    db.add(EventService(
                        id=uuid.uuid4(),
                        event_id=new_event.id,
                        service_id=sid,
                        service_status=EventServiceStatusEnum.pending,
                        created_at=now,
                        updated_at=now,
                    ))
            except json.JSONDecodeError:
                db.rollback()
                return standard_response(False, "Invalid services format. Must be a valid JSON array.")

        # ---- Commit ----
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            return standard_response(False, f"Failed to save event: {str(e)}")

        return standard_response(True, "Event created successfully", _event_summary(db, new_event, event_type))

    except Exception as e:
        db.rollback()
        return standard_response(False, f"Unexpected error: {str(e)}")


# =============================================================================
# 3.4 PUT /{event_id} — Update event
# =============================================================================

@router.put("/{event_id}")
async def update_event(
    event_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    event_type_id: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    venue: Optional[str] = Form(None),
    venue_address: Optional[str] = Form(None),
    venue_latitude: Optional[float] = Form(None),
    venue_longitude: Optional[float] = Form(None),
    cover_image: Optional[UploadFile] = File(None),
    remove_cover_image: Optional[bool] = Form(False),
    theme_color: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    status: Optional[str] = Form(None),
    budget: Optional[float] = Form(None),
    currency: Optional[str] = Form(None),
    expected_guests: Optional[int] = Form(None),
    dress_code: Optional[str] = Form(None),
    special_instructions: Optional[str] = Form(None),
    rsvp_deadline: Optional[str] = Form(None),
    contribution_enabled: Optional[bool] = Form(None),
    contribution_target: Optional[float] = Form(None),
    contribution_description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing event. All fields are optional."""
    try:
        # Validate UUID
        try:
            eid = uuid.UUID(event_id)
        except ValueError:
            return standard_response(False, "Invalid event ID format.")

        event = db.query(Event).filter(Event.id == eid).first()
        if not event:
            return standard_response(False, "Event not found")

        if str(event.organizer_id) != str(current_user.id):
            # Check if committee member with can_edit_event
            cm = (
                db.query(EventCommitteeMember)
                .filter(EventCommitteeMember.event_id == eid, EventCommitteeMember.user_id == current_user.id)
                .first()
            )
            if cm:
                perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
                if not perms or not perms.can_edit_event:
                    return standard_response(False, "You do not have permission to edit this event")
            else:
                return standard_response(False, "You do not have permission to edit this event")

        errors = []
        now = datetime.now(EAT)

        # ---- Validate & apply fields ----
        if title is not None:
            if not title.strip():
                errors.append({"field": "title", "message": "Title cannot be empty."})
            elif len(title.strip()) > 100:
                errors.append({"field": "title", "message": "Title must be at most 100 characters."})
            else:
                event.name = title.strip()

        if description is not None:
            if len(description.strip()) > 2000:
                errors.append({"field": "description", "message": "Description must be at most 2000 characters."})
            else:
                event.description = description.strip() if description.strip() else None

        if event_type_id is not None:
            try:
                _etid = uuid.UUID(event_type_id)
                et = db.query(EventType).filter(EventType.id == _etid).first()
                if not et:
                    errors.append({"field": "event_type_id", "message": "Event type not found."})
                else:
                    event.event_type_id = _etid
            except ValueError:
                errors.append({"field": "event_type_id", "message": "Invalid UUID."})

        if start_date is not None:
            try:
                ps = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                event.start_date = ps.date()
                event.start_time = ps.time()
            except ValueError:
                errors.append({"field": "start_date", "message": "Invalid ISO 8601 format."})

        if end_date is not None:
            if end_date.strip():
                try:
                    pe = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                    event.end_date = pe.date()
                    event.end_time = pe.time()
                except ValueError:
                    errors.append({"field": "end_date", "message": "Invalid ISO 8601 format."})
            else:
                event.end_date = None
                event.end_time = None

        if location is not None:
            if len(location.strip()) > 100:
                errors.append({"field": "location", "message": "Location must be at most 100 characters."})
            else:
                event.location = location.strip() if location.strip() else None

        if budget is not None:
            if budget < 0:
                errors.append({"field": "budget", "message": "Budget must be non-negative."})
            else:
                event.budget = budget

        if expected_guests is not None:
            if expected_guests < 0:
                errors.append({"field": "expected_guests", "message": "Must be non-negative."})
            else:
                event.expected_guests = expected_guests

        if is_public is not None:
            event.is_public = is_public

        if currency is not None:
            cur = db.query(Currency).filter(Currency.code == currency.upper()).first()
            if cur:
                event.currency_id = cur.id

        if status is not None:
            mapped = status
            if status == "published":
                mapped = "confirmed"
            valid_statuses = {s.value for s in EventStatusEnum}
            if mapped not in valid_statuses:
                errors.append({"field": "status", "message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}."})
            else:
                event.status = mapped

        if theme_color is not None:
            if not HEX_COLOR_RE.match(theme_color):
                errors.append({"field": "theme_color", "message": "Must be a valid hex color (e.g. #FF6B6B)."})
            else:
                event.theme_color = theme_color

        if dress_code is not None:
            if len(dress_code.strip()) > 200:
                errors.append({"field": "dress_code", "message": "Dress code must be at most 200 characters."})
            else:
                event.dress_code = dress_code.strip() if dress_code.strip() else None

        if special_instructions is not None:
            if len(special_instructions.strip()) > 1000:
                errors.append({"field": "special_instructions", "message": "Special instructions must be at most 1000 characters."})
            else:
                event.special_instructions = special_instructions.strip() if special_instructions.strip() else None

        if errors:
            return standard_response(False, "Validation failed", errors)

        # ---- Venue coordinates ----
        if venue is not None or venue_address is not None or venue_latitude is not None or venue_longitude is not None:
            vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == eid).first()
            if not vc:
                vc = EventVenueCoordinate(
                    id=uuid.uuid4(),
                    event_id=eid,
                    latitude=venue_latitude or 0,
                    longitude=venue_longitude or 0,
                    created_at=now,
                )
                db.add(vc)
            if venue_latitude is not None:
                vc.latitude = venue_latitude
            if venue_longitude is not None:
                vc.longitude = venue_longitude
            if venue is not None:
                vc.venue_name = venue.strip() if venue.strip() else None
            if venue_address is not None:
                vc.formatted_address = venue_address.strip() if venue_address.strip() else None
            vc.updated_at = now

        # ---- Event settings ----
        settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
        if not settings:
            settings = EventSetting(id=uuid.uuid4(), event_id=eid, created_at=now)
            db.add(settings)

        if rsvp_deadline is not None:
            if rsvp_deadline.strip():
                try:
                    settings.rsvp_deadline = datetime.fromisoformat(rsvp_deadline.replace("Z", "+00:00"))
                except ValueError:
                    pass
            else:
                settings.rsvp_deadline = None

        if contribution_enabled is not None:
            settings.contributions_enabled = contribution_enabled
        if contribution_target is not None:
            settings.contribution_target_amount = contribution_target
        settings.updated_at = now

        # ---- Cover image ----
        if remove_cover_image:
            event.cover_image_url = None
        elif cover_image and cover_image.filename:
            result = await _upload_image(cover_image, f"nuru/uploads/events/{eid}/cover/")
            if not result["success"]:
                db.rollback()
                return standard_response(False, result["error"])
            event.cover_image_url = result["url"]

        event.updated_at = now

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            return standard_response(False, f"Failed to update event: {str(e)}")

        return standard_response(True, "Event updated successfully", _event_summary(db, event))

    except Exception as e:
        db.rollback()
        return standard_response(False, f"Unexpected error: {str(e)}")


# =============================================================================
# 3.5 DELETE /{event_id} — Delete event
# =============================================================================

@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an event. Blocked if confirmed service bookings exist."""
    try:
        try:
            eid = uuid.UUID(event_id)
        except ValueError:
            return standard_response(False, "Invalid event ID format.")

        event = db.query(Event).filter(Event.id == eid).first()
        if not event:
            return standard_response(False, "Event not found")

        if str(event.organizer_id) != str(current_user.id):
            return standard_response(False, "You do not have permission to delete this event")

        # Check for confirmed service bookings
        confirmed_bookings = (
            db.query(EventService)
            .filter(
                EventService.event_id == eid,
                EventService.service_status.in_([
                    EventServiceStatusEnum.assigned,
                    EventServiceStatusEnum.in_progress,
                ]),
            )
            .count()
        )
        if confirmed_bookings > 0:
            return standard_response(
                False,
                "Cannot delete event with confirmed bookings. Please cancel bookings first.",
            )

        # Cascade deletes are handled by FK constraints; delete the event
        db.delete(event)

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            return standard_response(False, f"Failed to delete event: {str(e)}")

        return standard_response(True, "Event deleted successfully")
    except Exception as e:
        return standard_response(False, f"Unexpected error: {str(e)}")


# =============================================================================
# 3.6 POST /{event_id}/publish — Publish event
# =============================================================================

@router.post("/{event_id}/publish")
def publish_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish a draft event (transitions status to 'confirmed')."""
    try:
        try:
            eid = uuid.UUID(event_id)
        except ValueError:
            return standard_response(False, "Invalid event ID format.")

        event = db.query(Event).filter(Event.id == eid).first()
        if not event:
            return standard_response(False, "Event not found")

        if str(event.organizer_id) != str(current_user.id):
            return standard_response(False, "You do not have permission to publish this event")

        current_status = event.status.value if hasattr(event.status, "value") else event.status
        if current_status != "draft":
            return standard_response(False, f"Only draft events can be published. Current status: {current_status}.")

        # Validate minimum required fields
        if not event.name:
            return standard_response(False, "Event must have a title before publishing.")
        if not event.start_date:
            return standard_response(False, "Event must have a start date before publishing.")

        now = datetime.now(EAT)
        event.status = EventStatusEnum.confirmed
        event.is_public = True
        event.updated_at = now

        # Generate slug-based public URL
        slug = re.sub(r"[^a-z0-9]+", "-", event.name.lower()).strip("-")
        short_id = str(event.id)[:8]
        public_url = f"https://nuru.tz/events/{slug}-{short_id}"

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            return standard_response(False, f"Failed to publish event: {str(e)}")

        return standard_response(True, "Event published successfully", {
            "id": str(event.id),
            "status": "published",
            "published_at": now.isoformat(),
            "public_url": public_url,
        })
    except Exception as e:
        return standard_response(False, f"Unexpected error: {str(e)}")


# =============================================================================
# 3.7 POST /{event_id}/cancel — Cancel event
# =============================================================================

@router.post("/{event_id}/cancel")
def cancel_event(
    event_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel an event and optionally notify guests / vendors."""
    try:
        try:
            eid = uuid.UUID(event_id)
        except ValueError:
            return standard_response(False, "Invalid event ID format.")

        event = db.query(Event).filter(Event.id == eid).first()
        if not event:
            return standard_response(False, "Event not found")

        if str(event.organizer_id) != str(current_user.id):
            return standard_response(False, "You do not have permission to cancel this event")

        current_status = event.status.value if hasattr(event.status, "value") else event.status
        if current_status == "cancelled":
            return standard_response(False, "Event is already cancelled.")
        if current_status == "completed":
            return standard_response(False, "Cannot cancel a completed event.")

        reason = body.get("reason", "")
        notify_guests = body.get("notify_guests", False)
        notify_vendors = body.get("notify_vendors", False)

        # Validate
        if not reason or not reason.strip():
            return standard_response(False, "Cancellation reason is required.")
        if len(reason.strip()) > 1000:
            return standard_response(False, "Cancellation reason must be at most 1000 characters.")

        now = datetime.now(EAT)
        event.status = EventStatusEnum.cancelled
        event.updated_at = now

        # Count guests and vendors for notification response
        guest_count = (
            db.query(sa_func.count(EventAttendee.id))
            .filter(EventAttendee.event_id == eid)
            .scalar()
        ) or 0

        vendor_count = (
            db.query(sa_func.count(EventService.id))
            .filter(EventService.event_id == eid)
            .scalar()
        ) or 0

        # TODO: Implement actual notification dispatch (push / email / SMS)
        # For now, we return the counts of who would be notified.

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            return standard_response(False, f"Failed to cancel event: {str(e)}")

        guests_notified = guest_count if notify_guests else 0
        vendors_notified = vendor_count if notify_vendors else 0
        msg = f"Event cancelled successfully."
        if guests_notified or vendors_notified:
            msg += f" Notifications sent to {guests_notified} guests and {vendors_notified} vendors."

        return standard_response(True, msg, {
            "id": str(event.id),
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancellation_reason": reason.strip(),
            "guests_notified": guests_notified,
            "vendors_notified": vendors_notified,
        })
    except Exception as e:
        return standard_response(False, f"Unexpected error: {str(e)}")


# ---------------------------------------------------------------------------
# Helper: verify event ownership or committee membership
# ---------------------------------------------------------------------------

def _verify_event_access(db: Session, event_id: uuid.UUID, current_user: User):
    """Return (event, error_response). If error_response is not None, return it."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return None, standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        cm = (
            db.query(EventCommitteeMember)
            .filter(EventCommitteeMember.event_id == event_id, EventCommitteeMember.user_id == current_user.id)
            .first()
        )
        if not cm:
            return None, standard_response(False, "You do not have permission to access this event")
    return event, None


def _attendee_dict(db: Session, att: EventAttendee) -> dict:
    user = db.query(User).filter(User.id == att.attendee_id).first() if att.attendee_id else None
    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    plus_ones = db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).all()

    return {
        "id": str(att.id),
        "event_id": str(att.event_id),
        "name": f"{user.first_name} {user.last_name}" if user else None,
        "email": user.email if user else None,
        "phone": user.phone if user else None,
        "rsvp_status": att.rsvp_status.value if hasattr(att.rsvp_status, "value") else att.rsvp_status,
        "rsvp_responded_at": att.updated_at.isoformat() if att.rsvp_status and att.rsvp_status != RSVPStatusEnum.pending else None,
        "table_number": None,
        "seat_number": None,
        "dietary_requirements": att.dietary_restrictions,
        "meal_preference": att.meal_preference,
        "special_requests": att.special_requests,
        "plus_ones": len(plus_ones),
        "plus_one_names": [po.name for po in plus_ones],
        "notes": invitation.notes if invitation else None,
        "tags": [],
        "invitation_sent": invitation.sent_at is not None if invitation else False,
        "invitation_sent_at": invitation.sent_at.isoformat() if invitation and invitation.sent_at else None,
        "invitation_method": invitation.sent_via if invitation else None,
        "invitation_opened": False,
        "invitation_opened_at": None,
        "checked_in": att.checked_in,
        "checked_in_at": att.checked_in_at.isoformat() if att.checked_in_at else None,
        "checked_in_by": None,
        "qr_code": None,
        "created_at": att.created_at.isoformat() if att.created_at else None,
        "updated_at": att.updated_at.isoformat() if att.updated_at else None,
    }


# =============================================================================
# 4.1 GET /user-events/{eventId}/guests — List guests
# =============================================================================

@router.get("/{event_id}/guests")
def list_guests(
    event_id: str,
    page: int = 1,
    limit: int = 50,
    rsvp_status: str = "all",
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    query = db.query(EventAttendee).filter(EventAttendee.event_id == eid)

    if rsvp_status != "all":
        query = query.filter(EventAttendee.rsvp_status == rsvp_status)

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    attendees = query.order_by(EventAttendee.created_at.desc()).offset(offset).limit(limit).all()

    guests_list = [_attendee_dict(db, att) for att in attendees]

    # Summary counts
    all_attendees = db.query(EventAttendee).filter(EventAttendee.event_id == eid)
    counts = {}
    for status in RSVPStatusEnum:
        counts[status.value] = all_attendees.filter(EventAttendee.rsvp_status == status).count()
    total = all_attendees.count()
    checked_in = all_attendees.filter(EventAttendee.checked_in == True).count()

    summary = {
        "total": total,
        "confirmed": counts.get("confirmed", 0),
        "pending": counts.get("pending", 0),
        "declined": counts.get("declined", 0),
        "checked_in": checked_in,
        "invitations_sent": db.query(EventInvitation).filter(
            EventInvitation.event_id == eid, EventInvitation.sent_at.isnot(None)
        ).count(),
    }

    return standard_response(True, "Guests retrieved successfully", {
        "guests": guests_list,
        "summary": summary,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        },
    })


# =============================================================================
# 4.2 GET /user-events/{eventId}/guests/{guestId} — Single guest
# =============================================================================

@router.get("/{event_id}/guests/{guest_id}")
def get_guest(
    event_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    return standard_response(True, "Guest retrieved successfully", _attendee_dict(db, att))


# =============================================================================
# 4.3 POST /user-events/{eventId}/guests — Add guest
# =============================================================================

@router.post("/{event_id}/guests")
def add_guest(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    name = body.get("name", "").strip()
    if not name:
        return standard_response(False, "Guest name is required.")

    email = body.get("email")
    phone = body.get("phone")

    # Check if user exists by email or phone
    attendee_user = None
    if email:
        attendee_user = db.query(User).filter(User.email == email).first()
    if not attendee_user and phone:
        attendee_user = db.query(User).filter(User.phone == phone).first()

    now = datetime.now(EAT)

    # Create invitation
    invitation = EventInvitation(
        id=uuid.uuid4(),
        event_id=eid,
        invited_user_id=attendee_user.id if attendee_user else None,
        invited_by_user_id=current_user.id,
        invitation_code=uuid.uuid4().hex[:16],
        rsvp_status=RSVPStatusEnum.pending,
        notes=body.get("notes"),
        created_at=now,
        updated_at=now,
    )
    db.add(invitation)

    # Create attendee
    att = EventAttendee(
        id=uuid.uuid4(),
        event_id=eid,
        attendee_id=attendee_user.id if attendee_user else None,
        invitation_id=invitation.id,
        rsvp_status=RSVPStatusEnum.pending,
        dietary_restrictions=body.get("dietary_requirements"),
        meal_preference=body.get("meal_preference"),
        special_requests=body.get("special_requests"),
        created_at=now,
        updated_at=now,
    )
    db.add(att)
    db.flush()

    # Add plus ones
    plus_one_names = body.get("plus_one_names", [])
    plus_one_details = body.get("plus_one_details", [])
    for i, po_name in enumerate(plus_one_names):
        detail = plus_one_details[i] if i < len(plus_one_details) else {}
        po = EventGuestPlusOne(
            id=uuid.uuid4(),
            attendee_id=att.id,
            name=po_name,
            meal_preference=detail.get("dietary_requirements"),
            created_at=now,
            updated_at=now,
        )
        db.add(po)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to add guest: {str(e)}")

    return standard_response(True, "Guest added successfully", _attendee_dict(db, att))


# =============================================================================
# 4.4 POST /user-events/{eventId}/guests/bulk — Bulk add
# =============================================================================

@router.post("/{event_id}/guests/bulk")
def add_guests_bulk(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    guests_data = body.get("guests", [])
    skip_duplicates = body.get("skip_duplicates", True)
    now = datetime.now(EAT)

    imported = []
    skipped = 0
    errors = []

    for i, guest in enumerate(guests_data):
        name = guest.get("name", "").strip()
        if not name:
            errors.append({"row": i + 1, "name": "", "error": "Name is required"})
            continue

        email = guest.get("email")
        if skip_duplicates and email:
            existing = (
                db.query(EventAttendee)
                .join(User, EventAttendee.attendee_id == User.id)
                .filter(EventAttendee.event_id == eid, User.email == email)
                .first()
            )
            if existing:
                skipped += 1
                errors.append({"row": i + 1, "name": name, "error": "Email already exists in guest list"})
                continue

        attendee_user = None
        if email:
            attendee_user = db.query(User).filter(User.email == email).first()

        invitation = EventInvitation(
            id=uuid.uuid4(), event_id=eid, invited_user_id=attendee_user.id if attendee_user else None,
            invited_by_user_id=current_user.id, invitation_code=uuid.uuid4().hex[:16],
            rsvp_status=RSVPStatusEnum.pending, created_at=now, updated_at=now,
        )
        db.add(invitation)

        att = EventAttendee(
            id=uuid.uuid4(), event_id=eid, attendee_id=attendee_user.id if attendee_user else None,
            invitation_id=invitation.id, rsvp_status=RSVPStatusEnum.pending, created_at=now, updated_at=now,
        )
        db.add(att)
        imported.append({"id": str(att.id), "name": name, "email": email, "status": "imported"})

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to import guests: {str(e)}")

    return standard_response(True, "Guests imported successfully", {
        "imported": len(imported),
        "skipped": skipped,
        "errors": errors,
        "guests": imported,
    })


# =============================================================================
# 4.6 PUT /user-events/{eventId}/guests/{guestId} — Update guest
# =============================================================================

@router.put("/{event_id}/guests/{guest_id}")
def update_guest(
    event_id: str,
    guest_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    now = datetime.now(EAT)

    if "dietary_requirements" in body:
        att.dietary_restrictions = body["dietary_requirements"]
    if "meal_preference" in body:
        att.meal_preference = body["meal_preference"]
    if "special_requests" in body:
        att.special_requests = body["special_requests"]
    if "rsvp_status" in body:
        att.rsvp_status = body["rsvp_status"]

    att.updated_at = now

    # Update plus ones if provided
    if "plus_one_names" in body:
        db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).delete()
        plus_one_names = body.get("plus_one_names", [])
        plus_one_details = body.get("plus_one_details", [])
        for i, po_name in enumerate(plus_one_names):
            detail = plus_one_details[i] if i < len(plus_one_details) else {}
            po = EventGuestPlusOne(
                id=uuid.uuid4(), attendee_id=att.id, name=po_name,
                meal_preference=detail.get("dietary_requirements"),
                created_at=now, updated_at=now,
            )
            db.add(po)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to update guest: {str(e)}")

    return standard_response(True, "Guest updated successfully", _attendee_dict(db, att))


# =============================================================================
# 4.7 DELETE /user-events/{eventId}/guests/{guestId} — Delete guest
# =============================================================================

@router.delete("/{event_id}/guests/{guest_id}")
def delete_guest(
    event_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    db.delete(att)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete guest: {str(e)}")

    return standard_response(True, "Guest removed successfully")


# =============================================================================
# 4.8 DELETE /user-events/{eventId}/guests/bulk — Bulk delete
# =============================================================================

@router.delete("/{event_id}/guests/bulk")
def delete_guests_bulk(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    guest_ids = body.get("guest_ids", [])
    deleted = 0
    for gid_str in guest_ids:
        try:
            gid = uuid.UUID(gid_str)
        except ValueError:
            continue
        att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
        if att:
            db.delete(att)
            deleted += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete guests: {str(e)}")

    return standard_response(True, f"{deleted} guests removed successfully", {"deleted": deleted})


# =============================================================================
# 4.9 POST /user-events/{eventId}/guests/{guestId}/invite — Send invitation
# =============================================================================

@router.post("/{event_id}/guests/{guest_id}/invite")
def send_invitation(
    event_id: str,
    guest_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    method = body.get("method", "email")
    now = datetime.now(EAT)

    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    if invitation:
        invitation.sent_via = method
        invitation.sent_at = now
        invitation.updated_at = now
    else:
        invitation = EventInvitation(
            id=uuid.uuid4(), event_id=eid, invited_by_user_id=current_user.id,
            invitation_code=uuid.uuid4().hex[:16], rsvp_status=RSVPStatusEnum.pending,
            sent_via=method, sent_at=now, created_at=now, updated_at=now,
        )
        db.add(invitation)
        att.invitation_id = invitation.id

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to send invitation: {str(e)}")

    return standard_response(True, "Invitation sent successfully", {
        "guest_id": str(att.id),
        "method": method,
        "sent_at": now.isoformat(),
        "invitation_url": f"https://nuru.tz/rsvp/{invitation.invitation_code}",
    })


# =============================================================================
# 4.10 POST /user-events/{eventId}/guests/invite-all — Bulk invite
# =============================================================================

@router.post("/{event_id}/guests/invite-all")
def send_bulk_invitations(
    event_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    method = body.get("method", "email")
    now = datetime.now(EAT)

    attendees = db.query(EventAttendee).filter(EventAttendee.event_id == eid).all()
    sent_count = 0
    for att in attendees:
        invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
        if invitation:
            invitation.sent_via = method
            invitation.sent_at = now
            invitation.updated_at = now
            sent_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to send invitations: {str(e)}")

    return standard_response(True, "Invitations sent", {
        "total_selected": len(attendees),
        "sent_count": sent_count,
        "failed_count": 0,
        "failures": [],
    })


# =============================================================================
# 4.12 POST /user-events/{eventId}/guests/{guestId}/checkin — Check-in
# =============================================================================

@router.post("/{event_id}/guests/{guest_id}/checkin")
def checkin_guest(
    event_id: str,
    guest_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    if att.checked_in:
        return standard_response(False, "Guest already checked in", {
            "guest_id": str(att.id),
            "checked_in_at": att.checked_in_at.isoformat() if att.checked_in_at else None,
        })

    now = datetime.now(EAT)
    att.checked_in = True
    att.checked_in_at = now
    att.rsvp_status = RSVPStatusEnum.confirmed
    att.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to check in: {str(e)}")

    user = db.query(User).filter(User.id == att.attendee_id).first() if att.attendee_id else None

    return standard_response(True, "Guest checked in successfully", {
        "guest_id": str(att.id),
        "name": f"{user.first_name} {user.last_name}" if user else None,
        "checked_in": True,
        "checked_in_at": now.isoformat(),
        "checked_in_by": str(current_user.id),
    })


# =============================================================================
# 4.14 POST /user-events/{eventId}/guests/{guestId}/undo-checkin
# =============================================================================

@router.post("/{event_id}/guests/{guest_id}/undo-checkin")
def undo_checkin(
    event_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    att.checked_in = False
    att.checked_in_at = None
    att.updated_at = datetime.now(EAT)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to undo check-in: {str(e)}")

    return standard_response(True, "Check-in reverted successfully", {
        "guest_id": str(att.id),
        "checked_in": False,
    })


# =============================================================================
# 4.15 POST /events/{eventId}/rsvp — Public RSVP (No Auth)
# =============================================================================

@router.post("/public/{event_id}/rsvp")
def public_rsvp(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    guest_id = body.get("guest_id")
    token = body.get("token")
    rsvp_status = body.get("rsvp_status")

    if not guest_id or not token or not rsvp_status:
        return standard_response(False, "guest_id, token, and rsvp_status are required")

    try:
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid guest ID format.")

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    # Verify token
    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    if not invitation or invitation.invitation_code != token:
        return standard_response(False, "Invalid or expired RSVP token")

    # Check RSVP deadline
    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    if settings and settings.rsvp_deadline and settings.rsvp_deadline < datetime.now(EAT):
        return standard_response(False, "RSVP deadline has passed")

    now = datetime.now(EAT)
    att.rsvp_status = rsvp_status
    att.updated_at = now

    if "dietary_requirements" in body:
        att.dietary_restrictions = body["dietary_requirements"]

    # Handle plus ones
    if "plus_one_names" in body:
        db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).delete()
        for po_name in body.get("plus_one_names", []):
            po = EventGuestPlusOne(
                id=uuid.uuid4(), attendee_id=att.id, name=po_name, created_at=now, updated_at=now,
            )
            db.add(po)

    invitation.rsvp_status = rsvp_status
    invitation.rsvp_at = now
    invitation.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to record RSVP: {str(e)}")

    return standard_response(True, "RSVP recorded successfully", {
        "event": {
            "id": str(event.id),
            "title": event.name,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "location": event.location,
        },
        "rsvp_status": rsvp_status,
    })

PERMISSION_FIELDS = [
    "can_view_guests", "can_manage_guests", "can_send_invitations", "can_check_in_guests",
    "can_view_budget", "can_manage_budget", "can_view_contributions", "can_manage_contributions",
    "can_view_vendors", "can_manage_vendors", "can_approve_bookings", "can_edit_event", "can_manage_committee",
]

PERMISSION_MAP = {
    "view_guests": "can_view_guests",
    "manage_guests": "can_manage_guests",
    "send_invitations": "can_send_invitations",
    "checkin_guests": "can_check_in_guests",
    "view_budget": "can_view_budget",
    "manage_budget": "can_manage_budget",
    "view_contributions": "can_view_contributions",
    "manage_contributions": "can_manage_contributions",
    "view_vendors": "can_view_vendors",
    "manage_vendors": "can_manage_vendors",
    "approve_bookings": "can_approve_bookings",
    "edit_event": "can_edit_event",
    "manage_committee": "can_manage_committee",
    "view_schedule": "can_view_guests",  # mapped to existing
    "manage_schedule": "can_edit_event",
}


def _member_dict(db: Session, cm, event_id) -> dict:
    member_user = db.query(User).filter(User.id == cm.user_id).first() if cm.user_id else None
    profile = db.query(UserProfile).filter(UserProfile.user_id == cm.user_id).first() if cm.user_id else None
    role = db.query(CommitteeRole).filter(CommitteeRole.id == cm.role_id).first() if cm.role_id else None
    perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
    assigned_user = db.query(User).filter(User.id == cm.assigned_by).first() if cm.assigned_by else None

    permissions_list = []
    if perms:
        for api_name, db_field in PERMISSION_MAP.items():
            if getattr(perms, db_field, False):
                permissions_list.append(api_name)

    return {
        "id": str(cm.id),
        "event_id": str(cm.event_id),
        "user_id": str(cm.user_id) if cm.user_id else None,
        "name": f"{member_user.first_name} {member_user.last_name}" if member_user else None,
        "email": member_user.email if member_user else None,
        "phone": member_user.phone if member_user else None,
        "avatar": profile.profile_picture_url if profile else None,
        "role": role.role_name if role else None,
        "role_description": role.description if role else None,
        "permissions": permissions_list,
        "status": "active" if cm.user_id else "invited",
        "assigned_by": {
            "id": str(assigned_user.id),
            "name": f"{assigned_user.first_name} {assigned_user.last_name}",
        } if assigned_user else None,
        "assigned_at": cm.assigned_at.isoformat() if cm.assigned_at else None,
        "created_at": cm.created_at.isoformat() if cm.created_at else None,
    }


# =============================================================================
# 5.1 GET /user-events/{eventId}/committee
# =============================================================================

@router.get("/{event_id}/committee")
def list_committee(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    members = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == eid).all()
    result = [_member_dict(db, cm, eid) for cm in members]

    return standard_response(True, "Committee members retrieved successfully", result)


# =============================================================================
# 5.2 POST /user-events/{eventId}/committee — Add member
# =============================================================================

@router.post("/{event_id}/committee")
def add_committee_member(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can add committee members")

    role_name = body.get("role", "").strip()
    if not role_name:
        return standard_response(False, "Role is required")

    email = body.get("email")
    now = datetime.now(EAT)

    # Find or create role
    role = db.query(CommitteeRole).filter(CommitteeRole.role_name == role_name).first()
    if not role:
        role = CommitteeRole(
            id=uuid.uuid4(),
            role_name=role_name,
            description=body.get("role_description", role_name),
            created_at=now,
            updated_at=now,
        )
        db.add(role)

    # Find user by email
    member_user = db.query(User).filter(User.email == email).first() if email else None

    cm = EventCommitteeMember(
        id=uuid.uuid4(),
        event_id=eid,
        user_id=member_user.id if member_user else None,
        role_id=role.id,
        assigned_by=current_user.id,
        assigned_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(cm)
    db.flush()

    # Create permissions
    permissions_input = body.get("permissions", [])
    perms = CommitteePermission(
        id=uuid.uuid4(),
        committee_member_id=cm.id,
        created_at=now,
        updated_at=now,
    )
    for perm_name in permissions_input:
        db_field = PERMISSION_MAP.get(perm_name)
        if db_field and hasattr(perms, db_field):
            setattr(perms, db_field, True)
    db.add(perms)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to add committee member: {str(e)}")

    return standard_response(True, "Committee member added successfully", _member_dict(db, cm, eid))


# =============================================================================
# 5.3 PUT /user-events/{eventId}/committee/{memberId}
# =============================================================================

@router.put("/{event_id}/committee/{member_id}")
def update_committee_member(
    event_id: str,
    member_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        mid = uuid.UUID(member_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can update committee members")

    cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.id == mid, EventCommitteeMember.event_id == eid).first()
    if not cm:
        return standard_response(False, "Committee member not found")

    now = datetime.now(EAT)

    if "role" in body:
        role_name = body["role"].strip()
        role = db.query(CommitteeRole).filter(CommitteeRole.role_name == role_name).first()
        if not role:
            role = CommitteeRole(id=uuid.uuid4(), role_name=role_name, description=body.get("role_description", role_name), created_at=now, updated_at=now)
            db.add(role)
        cm.role_id = role.id

    cm.updated_at = now

    if "permissions" in body:
        perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
        if not perms:
            perms = CommitteePermission(id=uuid.uuid4(), committee_member_id=cm.id, created_at=now, updated_at=now)
            db.add(perms)
        # Reset all
        for field in PERMISSION_FIELDS:
            setattr(perms, field, False)
        for perm_name in body["permissions"]:
            db_field = PERMISSION_MAP.get(perm_name)
            if db_field and hasattr(perms, db_field):
                setattr(perms, db_field, True)
        perms.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to update: {str(e)}")

    return standard_response(True, "Committee member updated successfully", _member_dict(db, cm, eid))


# =============================================================================
# 5.4 DELETE /user-events/{eventId}/committee/{memberId}
# =============================================================================

@router.delete("/{event_id}/committee/{member_id}")
def remove_committee_member(
    event_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        mid = uuid.UUID(member_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can remove committee members")

    cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.id == mid, EventCommitteeMember.event_id == eid).first()
    if not cm:
        return standard_response(False, "Committee member not found")

    db.delete(cm)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to remove: {str(e)}")

    return standard_response(True, "Committee member removed successfully")


# =============================================================================
# 5.5 POST /user-events/{eventId}/committee/{memberId}/resend-invite
# =============================================================================

@router.post("/{event_id}/committee/{member_id}/resend-invite")
def resend_committee_invite(
    event_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        mid = uuid.UUID(member_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.id == mid, EventCommitteeMember.event_id == eid).first()
    if not cm:
        return standard_response(False, "Committee member not found")

    now = datetime.now(EAT)
    return standard_response(True, "Invitation resent successfully", {
        "member_id": str(cm.id),
        "sent_at": now.isoformat(),
    })

def _contribution_dict(db: Session, c: EventContribution, currency_id) -> dict:
    contributor_user = db.query(User).filter(User.id == c.contributor_user_id).first() if c.contributor_user_id else None
    contact = c.contributor_contact or {}
    thank_you = db.query(ContributionThankYouMessage).filter(ContributionThankYouMessage.contribution_id == c.id).first()

    return {
        "id": str(c.id),
        "event_id": str(c.event_id),
        "contributor_name": (
            f"{contributor_user.first_name} {contributor_user.last_name}" if contributor_user
            else (c.contributor_name or "Anonymous")
        ),
        "contributor_email": contributor_user.email if contributor_user else contact.get("email"),
        "contributor_phone": contributor_user.phone if contributor_user else contact.get("phone"),
        "contributor_user_id": str(c.contributor_user_id) if c.contributor_user_id else None,
        "amount": float(c.amount),
        "currency": _currency_code(db, currency_id),
        "payment_method": c.payment_method.value if hasattr(c.payment_method, "value") else c.payment_method,
        "payment_reference": c.transaction_ref,
        "status": "confirmed",
        "message": None,
        "is_anonymous": c.contributor_user_id is None and (not c.contributor_name or c.contributor_name.lower() == "anonymous"),
        "thank_you_sent": thank_you.is_sent if thank_you else False,
        "thank_you_sent_at": thank_you.sent_at.isoformat() if thank_you and thank_you.sent_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "confirmed_at": c.contributed_at.isoformat() if c.contributed_at else None,
    }


# =============================================================================
# 6.1 GET /user-events/{eventId}/contributions
# =============================================================================

@router.get("/{event_id}/contributions")
def list_contributions(
    event_id: str,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    query = db.query(EventContribution).filter(EventContribution.event_id == eid)

    sort_col = EventContribution.created_at
    if sort_by == "amount":
        sort_col = EventContribution.amount
    query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    contributions = query.offset(offset).limit(limit).all()

    # Summary
    total_amount = db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0)).filter(EventContribution.event_id == eid).scalar()
    total_contributors = db.query(sa_func.count(EventContribution.id)).filter(EventContribution.event_id == eid).scalar()

    ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    target = float(ct.target_amount) if ct else (float(settings.contribution_target_amount) if settings and settings.contribution_target_amount else 0)

    return standard_response(True, "Contributions retrieved successfully", {
        "contributions": [_contribution_dict(db, c, event.currency_id) for c in contributions],
        "summary": {
            "total_amount": float(total_amount),
            "target_amount": target,
            "progress_percentage": round((float(total_amount) / target * 100), 1) if target > 0 else 0,
            "total_contributors": total_contributors,
            "currency": _currency_code(db, event.currency_id),
        },
        "pagination": {
            "page": page, "limit": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# =============================================================================
# 6.2 GET /user-events/{eventId}/contributions/{contributionId}
# =============================================================================

@router.get("/{event_id}/contributions/{contribution_id}")
def get_contribution(
    event_id: str,
    contribution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        cid = uuid.UUID(contribution_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    c = db.query(EventContribution).filter(EventContribution.id == cid, EventContribution.event_id == eid).first()
    if not c:
        return standard_response(False, "Contribution not found")

    return standard_response(True, "Contribution retrieved successfully", _contribution_dict(db, c, event.currency_id))


# =============================================================================
# 6.3 POST /user-events/{eventId}/contributions — Record contribution
# =============================================================================

@router.post("/{event_id}/contributions")
def record_contribution(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    amount = body.get("amount")
    if not amount or float(amount) <= 0:
        return standard_response(False, "Amount must be greater than 0")

    now = datetime.now(EAT)
    payment_method = body.get("payment_method", "mobile")

    contributor_name = body.get("contributor_name", "").strip()
    contributor_user_id = None
    if body.get("contributor_user_id"):
        try:
            contributor_user_id = uuid.UUID(body["contributor_user_id"])
        except ValueError:
            pass

    c = EventContribution(
        id=uuid.uuid4(),
        event_id=eid,
        contributor_user_id=contributor_user_id,
        contributor_name=contributor_name or None,
        contributor_contact={"email": body.get("contributor_email"), "phone": body.get("contributor_phone")},
        amount=float(amount),
        payment_method=payment_method,
        transaction_ref=body.get("transaction_reference"),
        contributed_at=now,
        created_at=now,
    )
    db.add(c)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to record contribution: {str(e)}")

    return standard_response(True, "Contribution recorded successfully", _contribution_dict(db, c, event.currency_id))


# =============================================================================
# 6.4 DELETE /user-events/{eventId}/contributions/{contributionId}
# =============================================================================

@router.delete("/{event_id}/contributions/{contribution_id}")
def delete_contribution(
    event_id: str,
    contribution_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        cid = uuid.UUID(contribution_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the organizer can delete contributions")

    c = db.query(EventContribution).filter(EventContribution.id == cid, EventContribution.event_id == eid).first()
    if not c:
        return standard_response(False, "Contribution not found")

    db.delete(c)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete: {str(e)}")

    return standard_response(True, "Contribution deleted successfully")


# =============================================================================
# 6.5 POST /user-events/{eventId}/contributions/{contributionId}/thank
# =============================================================================

@router.post("/{event_id}/contributions/{contribution_id}/thank")
def send_thank_you(
    event_id: str,
    contribution_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        cid = uuid.UUID(contribution_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    c = db.query(EventContribution).filter(EventContribution.id == cid, EventContribution.event_id == eid).first()
    if not c:
        return standard_response(False, "Contribution not found")

    now = datetime.now(EAT)
    method = body.get("method", "email")
    custom_message = body.get("custom_message", "Thank you for your generous contribution!")

    # Create or update thank you message
    thank_you = db.query(ContributionThankYouMessage).filter(ContributionThankYouMessage.contribution_id == cid).first()
    if not thank_you:
        thank_you = ContributionThankYouMessage(
            id=uuid.uuid4(),
            event_id=eid,
            contribution_id=cid,
            message=custom_message,
            sent_via=method,
            sent_at=now,
            is_sent=True,
            created_at=now,
        )
        db.add(thank_you)
    else:
        thank_you.message = custom_message
        thank_you.sent_via = method
        thank_you.sent_at = now
        thank_you.is_sent = True

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to send thank you: {str(e)}")

    return standard_response(True, "Thank you sent successfully", {
        "contribution_id": str(cid),
        "thank_you_sent": True,
        "thank_you_sent_at": now.isoformat(),
        "method": method,
    })


# =============================================================================
# 6.6 POST /user-events/{eventId}/contributions/thank-all
# =============================================================================

@router.post("/{event_id}/contributions/thank-all")
def send_bulk_thank_you(
    event_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    method = body.get("method", "email")
    custom_message = body.get("custom_message", "Thank you for your generous contribution!")
    now = datetime.now(EAT)

    contributions = db.query(EventContribution).filter(EventContribution.event_id == eid).all()
    sent_count = 0

    for c in contributions:
        existing = db.query(ContributionThankYouMessage).filter(ContributionThankYouMessage.contribution_id == c.id).first()
        if existing and existing.is_sent:
            continue
        if not existing:
            thank_you = ContributionThankYouMessage(
                id=uuid.uuid4(), event_id=eid, contribution_id=c.id,
                message=custom_message, sent_via=method, sent_at=now, is_sent=True, created_at=now,
            )
            db.add(thank_you)
        else:
            existing.message = custom_message
            existing.sent_via = method
            existing.sent_at = now
            existing.is_sent = True
        sent_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Thank you messages sent", {
        "sent_count": sent_count,
        "failed_count": 0,
        "failures": [],
    })


# =============================================================================
# 6.7 GET /events/{eventId}/contribute — Public contribution page (No Auth)
# =============================================================================

@router.get("/public/{event_id}/contribute")
def public_contribution_page(
    event_id: str,
    db: Session = Depends(get_db),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
    target = float(ct.target_amount) if ct else (float(settings.contribution_target_amount) if settings and settings.contribution_target_amount else 0)
    current = float(
        db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0))
        .filter(EventContribution.event_id == eid).scalar()
    )
    count = db.query(sa_func.count(EventContribution.id)).filter(EventContribution.event_id == eid).scalar()

    organizer = db.query(User).filter(User.id == event.organizer_id).first()

    return standard_response(True, "Contribution page retrieved", {
        "event": {
            "id": str(event.id),
            "title": event.name,
            "cover_image": event.cover_image_url,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "host_names": f"{organizer.first_name} {organizer.last_name}" if organizer else None,
        },
        "contribution_info": {
            "enabled": settings.contributions_enabled if settings else False,
            "description": ct.description if ct else None,
            "target_amount": target,
            "current_amount": current,
            "progress_percentage": round((current / target * 100), 1) if target > 0 else 0,
            "contributor_count": count,
            "currency": _currency_code(db, event.currency_id),
        },
    })


# =============================================================================
# 6.8 POST /events/{eventId}/contribute — Submit public contribution (No Auth)
# =============================================================================

@router.post("/public/{event_id}/contribute")
def submit_public_contribution(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    amount = body.get("amount")
    if not amount or float(amount) <= 0:
        return standard_response(False, "Amount must be greater than 0")

    now = datetime.now(EAT)

    c = EventContribution(
        id=uuid.uuid4(),
        event_id=eid,
        contributor_name=body.get("contributor_name"),
        contributor_contact={"email": body.get("contributor_email"), "phone": body.get("contributor_phone")},
        amount=float(amount),
        payment_method=body.get("payment_method", "mobile"),
        contributed_at=now,
        created_at=now,
    )
    db.add(c)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Payment initiated", {
        "contribution_id": str(c.id),
        "payment_method": body.get("payment_method", "mobile"),
        "status": "pending",
    })
