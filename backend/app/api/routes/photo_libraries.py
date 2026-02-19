# Photo Libraries Routes - /photo-libraries/...
# Photography service providers can create event photo libraries and upload images

import os
import secrets
import uuid
from datetime import datetime
from typing import Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Query
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import (
    UserService, Event, EventImage, EventService, ServicePhotoLibrary, ServicePhotoLibraryImage,
    User, PhotoLibraryPrivacyEnum, EventServiceStatusEnum,
)
from utils.auth import get_current_user, get_optional_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/photo-libraries", tags=["Photo Libraries"])

# Storage constants
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024       # 10MB per image
MAX_SERVICE_STORAGE_BYTES = 200 * 1024 * 1024  # 200MB per service total

ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"}

# PHP storage query endpoint (same server as upload service)
STORAGE_SERVICE_BASE = "https://data.sewmrtechnologies.com"


def _build_folder_path(service_id: str, event_name: str) -> str:
    """Build the structured folder path: service_id/libraries/event_name"""
    safe_event = event_name.lower().replace(" ", "-").replace("/", "-")[:60]
    safe_event = "".join(c for c in safe_event if c.isalnum() or c in "-_")
    return f"nuru/photo-libraries/{service_id}/libraries/{safe_event}/"


def _library_dict(library: ServicePhotoLibrary, include_photos: bool = False, max_photos: int = None) -> dict:
    photos_data = []
    if include_photos:
        sorted_photos = sorted(library.photos, key=lambda x: x.display_order)
        if max_photos is not None:
            sorted_photos = sorted_photos[:max_photos]
        for p in sorted_photos:
            photos_data.append({
                "id": str(p.id),
                "url": p.image_url,
                "original_name": p.original_name,
                "file_size_bytes": p.file_size_bytes,
                "caption": p.caption,
                "display_order": p.display_order,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

    event = library.event
    service = library.user_service

    return {
        "id": str(library.id),
        "user_service_id": str(library.user_service_id),
        "event_id": str(library.event_id),
        "name": library.name,
        "description": library.description,
        "privacy": library.privacy.value if library.privacy else "event_creator_only",
        "share_token": library.share_token,
        "share_url": f"/shared/photo-library/{library.share_token}",
        "photo_count": library.photo_count or 0,
        "total_size_bytes": library.total_size_bytes or 0,
        "total_size_mb": round((library.total_size_bytes or 0) / (1024 * 1024), 2),
        "storage_limit_mb": 200,
        "storage_used_percent": round(((library.total_size_bytes or 0) / MAX_SERVICE_STORAGE_BYTES) * 100, 1),
        "is_active": library.is_active,
        "event": {
            "id": str(event.id),
            "name": event.name,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "location": event.location,
            "cover_image_url": event.cover_image_url,
            "organizer_id": str(event.organizer_id) if event.organizer_id else None,
        } if event else None,
        "service": {
            "id": str(service.id),
            "title": service.title,
        } if service else None,
        "photos": photos_data if include_photos else [],
        "created_at": library.created_at.isoformat() if library.created_at else None,
        "updated_at": library.updated_at.isoformat() if library.updated_at else None,
    }


def _get_service_total_storage(db: Session, service_id) -> int:
    """Sum up all storage used across all libraries for this service."""
    libraries = db.query(ServicePhotoLibrary).filter(
        ServicePhotoLibrary.user_service_id == service_id,
        ServicePhotoLibrary.is_active == True,
    ).all()
    return sum(lib.total_size_bytes or 0 for lib in libraries)


# ──────────────────────────────────────────────
# Get all libraries for my service
# ──────────────────────────────────────────────
@router.get("/service/{service_id}")
def get_service_libraries(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    libraries = db.query(ServicePhotoLibrary).filter(
        ServicePhotoLibrary.user_service_id == sid,
        ServicePhotoLibrary.is_active == True,
    ).order_by(ServicePhotoLibrary.created_at.desc()).all()

    total_storage_used = _get_service_total_storage(db, sid)

    return standard_response(True, "Libraries retrieved", {
        "libraries": [_library_dict(lib, include_photos=True, max_photos=3) for lib in libraries],
        "total_libraries": len(libraries),
        "storage_used_bytes": total_storage_used,
        "storage_used_mb": round(total_storage_used / (1024 * 1024), 2),
        "storage_limit_mb": 200,
        "storage_remaining_mb": round((MAX_SERVICE_STORAGE_BYTES - total_storage_used) / (1024 * 1024), 2),
    })


# ──────────────────────────────────────────────
# Get a single library with photos
# ──────────────────────────────────────────────
@router.get("/{library_id}")
def get_library(
    library_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(library_id)
    except ValueError:
        return standard_response(False, "Invalid library ID")

    library = db.query(ServicePhotoLibrary).filter(ServicePhotoLibrary.id == lid).first()
    if not library or not library.is_active:
        return standard_response(False, "Library not found")

    # Access: service owner OR event organizer OR public
    is_owner = library.user_service.user_id == current_user.id
    is_event_organizer = library.event.organizer_id == current_user.id if library.event else False
    is_public = library.privacy == PhotoLibraryPrivacyEnum.public

    if not is_owner and not is_event_organizer and not is_public:
        return standard_response(False, "Access denied")

    data = _library_dict(library, include_photos=True)
    data["is_owner"] = is_owner
    return standard_response(True, "Library retrieved", data)


# ──────────────────────────────────────────────
# Access via share token (public link) — NO auth required for public libraries
# ──────────────────────────────────────────────
@router.get("/shared/{share_token}")
def get_library_by_token(
    share_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    library = db.query(ServicePhotoLibrary).filter(
        ServicePhotoLibrary.share_token == share_token,
        ServicePhotoLibrary.is_active == True,
    ).first()
    if not library:
        return standard_response(False, "Library not found or link is invalid")

    # Public libraries: accessible by anyone (even without auth token)
    if library.privacy == PhotoLibraryPrivacyEnum.public:
        data = _library_dict(library, include_photos=True)
        data["is_owner"] = False
        return standard_response(True, "Library retrieved", data)

    # Private libraries: only accessible to owner or event organizer
    if current_user is None:
        return standard_response(False, "This library is private")

    is_owner = library.user_service.user_id == current_user.id
    is_event_organizer = library.event.organizer_id == current_user.id if library.event else False

    if not is_owner and not is_event_organizer:
        return standard_response(False, "This library is private")

    data = _library_dict(library, include_photos=True)
    data["is_owner"] = is_owner
    return standard_response(True, "Library retrieved", data)


# ──────────────────────────────────────────────
# Create photo library (for a confirmed event)
# ──────────────────────────────────────────────
@router.post("/service/{service_id}/create")
def create_library(
    service_id: str,
    event_id: str = Form(...),
    privacy: str = Form("event_creator_only"),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid service or event ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    # Check service is confirmed for this event
    event_service = db.query(EventService).filter(
        EventService.event_id == eid,
        EventService.provider_user_service_id == sid,
        EventService.service_status.in_([
            EventServiceStatusEnum.assigned,
            EventServiceStatusEnum.in_progress,
            EventServiceStatusEnum.completed,
        ]),
    ).first()
    if not event_service:
        return standard_response(False, "Your service is not confirmed for this event")

    # Check for existing library
    existing = db.query(ServicePhotoLibrary).filter(
        ServicePhotoLibrary.user_service_id == sid,
        ServicePhotoLibrary.event_id == eid,
    ).first()
    if existing:
        return standard_response(False, "A photo library already exists for this event")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    # Generate name from event name
    library_name = f"{event.name} - Photo Library"

    # Validate privacy
    try:
        privacy_enum = PhotoLibraryPrivacyEnum(privacy)
    except ValueError:
        privacy_enum = PhotoLibraryPrivacyEnum.event_creator_only

    share_token = secrets.token_urlsafe(24)
    now = datetime.now(EAT)

    library = ServicePhotoLibrary(
        id=uuid.uuid4(),
        user_service_id=sid,
        event_id=eid,
        name=library_name,
        description=description,
        privacy=privacy_enum,
        share_token=share_token,
        photo_count=0,
        total_size_bytes=0,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(library)
    db.commit()
    db.refresh(library)

    return standard_response(True, "Photo library created successfully", _library_dict(library, include_photos=False))


# ──────────────────────────────────────────────
# Update library settings (privacy, description)
# ──────────────────────────────────────────────
@router.put("/{library_id}")
def update_library(
    library_id: str,
    privacy: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(library_id)
    except ValueError:
        return standard_response(False, "Invalid library ID")

    library = db.query(ServicePhotoLibrary).filter(ServicePhotoLibrary.id == lid).first()
    if not library or not library.is_active:
        return standard_response(False, "Library not found")

    if library.user_service.user_id != current_user.id:
        return standard_response(False, "Access denied")

    if privacy is not None:
        try:
            library.privacy = PhotoLibraryPrivacyEnum(privacy)
        except ValueError:
            pass
    if description is not None:
        library.description = description

    library.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Library updated", _library_dict(library))


# ──────────────────────────────────────────────
# Upload a single image to a library
# ──────────────────────────────────────────────
@router.post("/{library_id}/upload")
async def upload_photo(
    library_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(library_id)
    except ValueError:
        return standard_response(False, "Invalid library ID")

    library = db.query(ServicePhotoLibrary).filter(ServicePhotoLibrary.id == lid).first()
    if not library or not library.is_active:
        return standard_response(False, "Library not found")

    if library.user_service.user_id != current_user.id:
        return standard_response(False, "Access denied - you don't own this library")

    # Validate mime type
    if file.content_type not in ALLOWED_IMAGE_MIMES:
        return standard_response(False, "Only image files are allowed (JPEG, PNG, WebP, AVIF, GIF)")

    content = await file.read()
    file_size = len(content)

    # 10MB per image limit
    if file_size > MAX_IMAGE_SIZE_BYTES:
        return standard_response(False, f"Image too large. Maximum size is 10MB, your file is {round(file_size / (1024*1024), 1)}MB")

    # Check service total storage (200MB)
    service_used = _get_service_total_storage(db, library.user_service_id)
    if service_used + file_size > MAX_SERVICE_STORAGE_BYTES:
        remaining_mb = round((MAX_SERVICE_STORAGE_BYTES - service_used) / (1024 * 1024), 2)
        return standard_response(False, f"Storage limit exceeded. You have {remaining_mb}MB remaining out of 200MB")

    # Build folder path: service_id/libraries/event_name
    folder_path = _build_folder_path(str(library.user_service_id), library.event.name if library.event else str(library.event_id))

    _, ext = os.path.splitext(file.filename or "image.jpg")
    unique_name = f"{uuid.uuid4().hex}{ext}"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                UPLOAD_SERVICE_URL,
                data={"target_path": folder_path},
                files={"file": (unique_name, content, file.content_type)},
                timeout=30,
            )
        except Exception as e:
            return standard_response(False, f"Upload failed: {str(e)}")

    result = resp.json()
    if not result.get("success"):
        return standard_response(False, result.get("message", "Upload failed"))

    url = result["data"]["url"]
    now = datetime.now(EAT)

    # Count existing photos for display_order
    existing_count = db.query(ServicePhotoLibraryImage).filter(
        ServicePhotoLibraryImage.library_id == lid
    ).count()

    photo = ServicePhotoLibraryImage(
        id=uuid.uuid4(),
        library_id=lid,
        image_url=url,
        original_name=file.filename,
        file_size_bytes=file_size,
        caption=caption,
        display_order=existing_count,
        created_at=now,
    )
    db.add(photo)

    # Update library totals
    library.photo_count = (library.photo_count or 0) + 1
    library.total_size_bytes = (library.total_size_bytes or 0) + file_size
    library.updated_at = now

    db.commit()

    return standard_response(True, "Photo uploaded successfully", {
        "id": str(photo.id),
        "url": url,
        "original_name": file.filename,
        "file_size_bytes": file_size,
        "caption": caption,
        "display_order": photo.display_order,
        "library_id": str(lid),
        "storage_used_bytes": library.total_size_bytes,
        "storage_used_mb": round(library.total_size_bytes / (1024 * 1024), 2),
    })


# ──────────────────────────────────────────────
# Delete a photo from a library
# ──────────────────────────────────────────────
@router.delete("/{library_id}/photos/{photo_id}")
def delete_photo(
    library_id: str,
    photo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(library_id)
        pid = uuid.UUID(photo_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    library = db.query(ServicePhotoLibrary).filter(ServicePhotoLibrary.id == lid).first()
    if not library:
        return standard_response(False, "Library not found")

    if library.user_service.user_id != current_user.id:
        return standard_response(False, "Access denied")

    photo = db.query(ServicePhotoLibraryImage).filter(
        ServicePhotoLibraryImage.id == pid,
        ServicePhotoLibraryImage.library_id == lid,
    ).first()
    if not photo:
        return standard_response(False, "Photo not found")

    photo_url = photo.url  # capture before delete

    # Update library totals
    library.photo_count = max(0, (library.photo_count or 1) - 1)
    library.total_size_bytes = max(0, (library.total_size_bytes or 0) - (photo.file_size_bytes or 0))
    library.updated_at = datetime.now(EAT)

    db.delete(photo)
    db.commit()

    # Physically remove file from storage (best-effort, synchronous)
    from utils.helpers import delete_storage_file_sync
    delete_storage_file_sync(photo_url)

    return standard_response(True, "Photo deleted successfully")


# ──────────────────────────────────────────────
# Delete entire library
# ──────────────────────────────────────────────
@router.delete("/{library_id}")
def delete_library(
    library_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lid = uuid.UUID(library_id)
    except ValueError:
        return standard_response(False, "Invalid library ID")

    library = db.query(ServicePhotoLibrary).filter(ServicePhotoLibrary.id == lid).first()
    if not library:
        return standard_response(False, "Library not found")

    if library.user_service.user_id != current_user.id:
        return standard_response(False, "Access denied")

    library.is_active = False
    library.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Library deleted successfully")


# ──────────────────────────────────────────────
# Get events where my service is confirmed (for photography service)
# ──────────────────────────────────────────────
@router.get("/service/{service_id}/events")
def get_service_confirmed_events(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    event_services = db.query(EventService).filter(
        EventService.provider_user_service_id == sid,
        EventService.service_status.in_([
            EventServiceStatusEnum.assigned,
            EventServiceStatusEnum.in_progress,
            EventServiceStatusEnum.completed,
        ]),
    ).all()

    now = datetime.now(EAT)
    today_date = now.date()

    events_data = []
    for es in event_services:
        event = es.event
        if not event:
            continue

        # Determine status
        # start_date may be a date or datetime object depending on DB column type
        raw_date = event.start_date
        if raw_date is None:
            event_date = None
        elif hasattr(raw_date, 'date'):
            event_date = raw_date.date()
        else:
            event_date = raw_date
        if event_date is None:
            timing = "upcoming"
        elif event_date < today_date:
            timing = "completed"
        elif event_date == today_date:
            timing = "today"
        else:
            timing = "upcoming"

        # Check if library exists
        library = db.query(ServicePhotoLibrary).filter(
            ServicePhotoLibrary.user_service_id == sid,
            ServicePhotoLibrary.event_id == event.id,
            ServicePhotoLibrary.is_active == True,
        ).first()

        # Build photo_library dict with up to 6 thumbnails for mosaic display
        photo_library_data = None
        if library:
            photo_library_data = _library_dict(library, include_photos=True, max_photos=6)

        # Resolve the best cover image for this event:
        # 1. event.cover_image_url, 2. featured EventImage, 3. first EventImage
        cover_image_url = event.cover_image_url
        if not cover_image_url:
            event_imgs = db.query(EventImage).filter(
                EventImage.event_id == event.id
            ).order_by(EventImage.is_featured.desc(), EventImage.created_at.asc()).limit(1).first()
            if event_imgs:
                cover_image_url = event_imgs.image_url

        events_data.append({
            "event_service_id": str(es.id),
            "event_id": str(event.id),
            "event_name": event.name,
            "event_date": event.start_date.isoformat() if event.start_date else None,
            "event_date_display": event.start_date.strftime("%A, %d %B %Y") if event.start_date else None,
            "location": event.location,
            "cover_image_url": cover_image_url,
            "status": es.service_status.value,
            "agreed_price": float(es.agreed_price) if es.agreed_price else None,
            "timing": timing,
            "organizer_id": str(event.organizer_id) if event.organizer_id else None,
            "organizer_name": f"{event.organizer.first_name} {event.organizer.last_name}" if event.organizer else None,
            "organizer_avatar": event.organizer.profile.profile_picture_url if event.organizer and event.organizer.profile else None,
            "photo_library": photo_library_data,
            "has_library": library is not None,
        })

    # Sort: today first, then upcoming, then completed
    order = {"today": 0, "upcoming": 1, "completed": 2}
    events_data.sort(key=lambda x: (order.get(x["timing"], 3), x["event_date"] or ""))

    return standard_response(True, "Confirmed events retrieved", {
        "events": events_data,
        "total": len(events_data),
        "service_title": service.title,
    })


# ──────────────────────────────────────────────
# Get photo libraries for an event (for event creator view)
# ──────────────────────────────────────────────
@router.get("/event/{event_id}")
def get_event_photo_libraries(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    is_organizer = event.organizer_id == current_user.id

    if not is_organizer:
        return standard_response(False, "Access denied")

    libraries = db.query(ServicePhotoLibrary).filter(
        ServicePhotoLibrary.event_id == eid,
        ServicePhotoLibrary.is_active == True,
    ).all()

    return standard_response(True, "Photo libraries retrieved", {
        "libraries": [_library_dict(lib, include_photos=True) for lib in libraries],
        "total": len(libraries),
    })
