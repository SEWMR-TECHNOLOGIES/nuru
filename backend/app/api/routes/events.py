from datetime import datetime
import json
import os
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
import httpx
import pytz
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from core.config import ALLOWED_IMAGE_EXTENSIONS, MAX_EVENT_IMAGES, MAX_IMAGE_SIZE, UPLOAD_SERVICE_URL
from models.enums import EventStatusEnum
from models.users import User
from utils.auth import get_current_user
from models.services import UserService
from utils.helpers import format_price
from models.events import Event, EventImage, EventService, EventType, EventTypeService
from core.database import get_db

router = APIRouter()


@router.get("/recommendations/{event_type_id}", response_model=List[Dict])
def get_event_recommendations(event_type_id: str, db: Session = Depends(get_db)):
    """
    Fetch recommended services for a given event type.
    Returns dynamic price ranges based on available providers.
    """

    recommendations = db.query(EventTypeService).filter(
        EventTypeService.event_type_id == event_type_id
    ).all()

    if not recommendations:
        return []

    result = []
    for rec in recommendations:
        priority = rec.priority or "medium"

        # Fetch services for this recommendation
        services = db.query(UserService).filter(
            UserService.service_type_id == rec.service_type_id,
            UserService.is_active == True,
            UserService.availability == "available",
            UserService.is_verified == True,
            UserService.verification_status == "verified"
        ).all()

        min_price = max_price = None
        if services:
            # Use is not None to handle 0 prices
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
            "service_type_name": rec.service_type.name,
            "category_name": rec.service_type.category.name if rec.service_type.category else None,
            "priority": priority,
            "is_mandatory": rec.is_mandatory,
            "description": rec.description,
            "min_price": format_price(min_price),
            "max_price": format_price(max_price),
            "estimated_cost": price_range,
            "available_providers": len(services)
        })

    return result

@router.post("/new")
async def create_event(
    event_type_id: Optional[uuid.UUID] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    date: Optional[str] = Form(None),  
    time: Optional[str] = Form(None),  
    location: Optional[str] = Form(None),
    expected_guests: Optional[int] = Form(None),
    budget: Optional[float] = Form(None),
    services: Optional[str] = Form(None),  
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new event with detailed validation messages."""

    # 1. Field-specific validations
    if not title or not title.strip():
        raise HTTPException(status_code=400, detail="Event title cannot be empty. Please provide a descriptive title for your event, e.g., 'Sarah & John's Wedding'.")
    if not event_type_id:
        raise HTTPException(status_code=400, detail="Event type is missing. You must select a valid event type such as 'Wedding' or 'Birthday'.")
    if not date or not date.strip():
        raise HTTPException(status_code=400, detail="Event date is missing. Please provide the date in YYYY-MM-DD format.")
    if not time or not time.strip():
        raise HTTPException(status_code=400, detail="Event start time is missing. Please provide a valid time in HH:mm format.")
    if not location or not location.strip():
        raise HTTPException(status_code=400, detail="Event location is required. Provide the venue or address where the event will take place.")
    if expected_guests is None or expected_guests <= 0:
        raise HTTPException(status_code=400, detail="Expected guests must be a number greater than zero. Please estimate how many people will attend.")
    if budget is None or budget <= 0:
        raise HTTPException(status_code=400, detail="Budget must be a positive number. Please provide the estimated budget for this event.")

    # 2. Parse datetime
    try:
        event_start = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date or time format. Date should be YYYY-MM-DD and time should be HH:mm.")

    # 3. Check event type existence
    event_type = db.query(EventType).filter(EventType.id == event_type_id).first()
    if not event_type:
        raise HTTPException(status_code=404, detail="Selected event type does not exist. Please choose a valid event type.")

    # 4. Create Event record
    new_event = Event(
        id=uuid.uuid4(),
        organizer_id=current_user.id,
        name=title.strip(),
        event_type_id=event_type_id,
        description=description.strip() if description else None,
        start_date=event_start.date(),
        start_time=event_start.time(),
        end_date=None,  # Optional, can extend later
        end_time=None,  # Optional, can extend later
        location=location.strip(),
        expected_guests=expected_guests,
        budget=budget,
        status=EventStatusEnum.draft,
        created_at=datetime.now(pytz.timezone("Africa/Nairobi")),
        updated_at=datetime.now(pytz.timezone("Africa/Nairobi")),
    )

    db.add(new_event)
    db.flush()  # Get ID for relations

    # 5. Handle services
    if services:
        try:
            service_list = json.loads(services)
            for s in service_list:
                if "service_id" not in s:
                    raise HTTPException(status_code=400, detail="Each service object must include 'service_id'.")
                db.add(EventService(
                    id=uuid.uuid4(),
                    event_id=new_event.id,
                    service_id=uuid.UUID(s["service_id"]),
                    service_status="pending"
                ))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid services format. Must be a JSON array of objects with 'service_id'.")

    # 6. Handle image uploads
    uploaded_image_urls = []
    if images:
        if len(images) > MAX_EVENT_IMAGES:
            raise HTTPException(status_code=400, detail=f"You can upload a maximum of {MAX_EVENT_IMAGES} images for an event.")
        for file in images:
            _, ext = os.path.splitext(file.filename)
            ext = ext.lower().replace(".", "")
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{file.filename}' has invalid format. Allowed formats: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}."
                )
            content = await file.read()
            if len(content) > MAX_IMAGE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{file.filename}' exceeds the maximum allowed size of 0.5MB."
                )
            # Upload image to external service
            unique_name = f"{uuid.uuid4().hex}.{ext}"
            upload_data = {"target_path": f"nuru/uploads/events/{new_event.id}/"}
            upload_files = {"file": (unique_name, content, file.content_type)}
            
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(UPLOAD_SERVICE_URL, data=upload_data, files=upload_files, timeout=20)
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to upload image '{file.filename}': {str(e)}")

            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Image upload service returned {resp.status_code} for file '{file.filename}'.")

            result = resp.json()
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("message", f"Image upload failed for '{file.filename}'."))

            image_record = EventImage(
                id=uuid.uuid4(),
                event_id=new_event.id,
                image_url=result["data"]["url"],
                created_at=datetime.now(pytz.timezone("Africa/Nairobi")),
                updated_at=datetime.now(pytz.timezone("Africa/Nairobi")),
            )
            db.add(image_record)
            uploaded_image_urls.append(result["data"]["url"])

    # 7. Commit transaction
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save event: {str(e)}")

    return {
        "success": True,
        "message": "Event created successfully.",
        "data": {
            "id": str(new_event.id),
            "title": new_event.name,
            "description": new_event.description,
            "start_date": new_event.start_date.isoformat() if new_event.start_date else None,
            "start_time": new_event.start_time.strftime("%H:%M") if new_event.start_time else None,
            "end_date": new_event.end_date.isoformat() if new_event.end_date else None,
            "end_time": new_event.end_time.strftime("%H:%M") if new_event.end_time else None,
            "location": new_event.location,
            "budget": float(new_event.budget) if new_event.budget else None,
            "expected_guests": new_event.expected_guests,
            "images": uploaded_image_urls,
            "services": services
        }
}
