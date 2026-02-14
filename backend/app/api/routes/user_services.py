# User Services Routes - /user-services/...
# Handles vendor service management: CRUD, KYC, packages, bookings, reviews

import os
import uuid
from datetime import datetime
from typing import List, Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import (
    UserService, UserServiceImage, UserServiceVerification,
    UserServiceVerificationFile, UserServiceKYCStatus,
    ServicePackage, UserServiceRating,
    ServiceReviewHelpful, ServiceCategory, ServiceType,
    ServiceKYCMapping, KYCRequirement, ServiceBookingRequest, User,
    VerificationStatusEnum,
)
from utils.auth import get_current_user
from utils.helpers import format_price, standard_response

EAT = pytz.timezone("Africa/Nairobi")

router = APIRouter(prefix="/user-services", tags=["User Services"])


def _service_dict(db, service):
    """Build service response dict matching nuru-api-doc structure."""
    # Images as objects per API doc
    images = []
    for img in service.images:
        images.append({
            "id": str(img.id),
            "url": img.image_url,
            "thumbnail_url": getattr(img, "thumbnail_url", None),
            "alt": getattr(img, "alt_text", None),
            "is_featured": getattr(img, "is_featured", False),
            "display_order": getattr(img, "display_order", 0),
        })

    ratings = [r.rating for r in service.ratings]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0

    kyc_mappings = db.query(ServiceKYCMapping).filter(ServiceKYCMapping.service_type_id == service.service_type_id).all()
    verified_count = 0
    kyc_list = []
    for mapping in kyc_mappings:
        kyc_req = mapping.kyc_requirement
        kyc_status = db.query(UserServiceKYCStatus).filter(UserServiceKYCStatus.user_service_id == service.id, UserServiceKYCStatus.kyc_requirement_id == kyc_req.id).first()
        status = kyc_status.status if kyc_status else None
        if status == VerificationStatusEnum.verified:
            verified_count += 1
        kyc_list.append({"id": str(kyc_req.id), "name": kyc_req.name, "description": kyc_req.description, "is_mandatory": mapping.is_mandatory, "status": status.value if status else None, "remarks": kyc_status.remarks if kyc_status else None})

    total_kyc = len(kyc_mappings)
    verification_progress = int((verified_count / total_kyc) * 100) if total_kyc > 0 else 0

    packages = [{"id": str(p.id), "name": p.name, "price": float(p.price) if p.price else None, "description": p.description, "features": p.features or []} for p in getattr(service, "packages", [])]

    return {
        "id": str(service.id),
        "user_id": str(service.user_id),
        "title": service.title,
        "description": service.description,
        "service_category_id": str(service.category_id) if service.category_id else None,
        "service_category": {"id": str(service.category.id), "name": service.category.name} if service.category else None,
        "service_type_id": str(service.service_type_id) if service.service_type_id else None,
        "service_type": {"id": str(service.service_type.id), "name": service.service_type.name} if service.service_type else None,
        "service_type_name": service.service_type.name if service.service_type else None,
        "category": service.category.name if service.category else None,
        "min_price": float(service.min_price) if service.min_price else None,
        "max_price": float(service.max_price) if service.max_price else None,
        "currency": "TZS",
        "location": service.location,
        "status": "active" if service.is_active else "inactive",
        "verification_status": service.verification_status.value if service.verification_status else "unverified",
        "verification_progress": verification_progress,
        "images": images,
        "rating": avg_rating,
        "review_count": len(ratings),
        "booking_count": getattr(service, "booking_count", 0) or 0,
        "completed_events": getattr(service, "completed_events", 0) or 0,
        "availability": service.availability.value if hasattr(service.availability, "value") else (service.availability or "available"),
        "is_verified": service.is_verified,
        "kyc_list": kyc_list,
        "packages": packages,
        "package_count": len(packages),
        "created_at": service.created_at.isoformat() if service.created_at else None,
        "updated_at": service.updated_at.isoformat() if service.updated_at else None,
    }


# ──────────────────────────────────────────────
# Get All My Services
# ──────────────────────────────────────────────
@router.get("/")
def get_my_services(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    services = db.query(UserService).filter(UserService.user_id == current_user.id).all()
    service_list = [_service_dict(db, s) for s in services]

    # Collect all recent reviews across all services
    all_service_ids = [s.id for s in services]
    recent_reviews = []
    if all_service_ids:
        reviews_query = db.query(UserServiceRating).filter(
            UserServiceRating.user_service_id.in_(all_service_ids)
        ).order_by(UserServiceRating.created_at.desc()).limit(5).all()
        for r in reviews_query:
            svc = db.query(UserService).filter(UserService.id == r.user_service_id).first()
            recent_reviews.append({
                "id": str(r.id),
                "service_id": str(r.user_service_id),
                "service_title": svc.title if svc else None,
                "rating": r.rating,
                "comment": r.review,
                "user_name": f"{r.user.first_name} {r.user.last_name}" if r.user else "Anonymous",
                "user_avatar": r.user.profile.profile_picture_url if r.user and r.user.profile else None,
                "created_at": r.created_at.isoformat(),
            })

    # Build summary per API doc
    summary = {
        "total_services": len(service_list),
        "active_services": sum(1 for s in service_list if s["status"] == "active"),
        "verified_services": sum(1 for s in service_list if s["verification_status"] == "verified"),
        "pending_verification": sum(1 for s in service_list if s["verification_status"] == "pending"),
        "total_reviews": sum(s["review_count"] for s in service_list),
        "average_rating": round(sum(s["rating"] for s in service_list) / len(service_list), 1) if service_list else 0,
    }

    return standard_response(True, "Services retrieved successfully", {"services": service_list, "summary": summary, "recent_reviews": recent_reviews})


# ──────────────────────────────────────────────
# Get Single Service
# ──────────────────────────────────────────────
@router.get("/{service_id}")
def get_service(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found or does not belong to you")

    data = _service_dict(db, service)

    # Add reviews
    data["reviews"] = [{"id": str(r.id), "rating": r.rating, "comment": r.review, "date": r.created_at.isoformat()} for r in service.ratings]

    return standard_response(True, f"Service '{service.title}' details fetched successfully", data)


# ──────────────────────────────────────────────
# Create Service
# ──────────────────────────────────────────────
@router.post("/")
async def create_service(
    title: str = Form(...), description: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None), service_type_id: Optional[str] = Form(None),
    min_price: Optional[float] = Form(None), max_price: Optional[float] = Form(None),
    location: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not title or not title.strip():
        return standard_response(False, "Service title is required")

    now = datetime.now(EAT)
    service = UserService(
        id=uuid.uuid4(), user_id=current_user.id, title=title.strip(),
        description=description.strip() if description else None,
        category_id=uuid.UUID(category_id) if category_id else None,
        service_type_id=uuid.UUID(service_type_id) if service_type_id else None,
        min_price=min_price, max_price=max_price,
        location=location.strip() if location else None,
        is_active=True, is_verified=False, verification_status=VerificationStatusEnum.pending,
        created_at=now, updated_at=now,
    )
    db.add(service)
    db.flush()

    if images:
        for i, file in enumerate(images):
            if not file or not file.filename:
                continue
            _, ext = os.path.splitext(file.filename)
            content = await file.read()
            unique_name = f"{uuid.uuid4().hex}{ext}"
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(
                        UPLOAD_SERVICE_URL,
                        data={"target_path": f"nuru/uploads/services/{service.id}/"},
                        files={"file": (unique_name, content, file.content_type)},
                        timeout=20
                    )
                    result = resp.json()
                    if result.get("success"):
                        img = UserServiceImage(
                            id=uuid.uuid4(),
                            user_service_id=service.id,
                            image_url=result["data"]["url"],
                            created_at=now
                        )
                        db.add(img)
                        db.flush()  # <<< add this line
                except Exception as e:
                    print(f"Image upload failed: {e}")  # <<< change this line to see errors


    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to create service: {str(e)}")

    return standard_response(True, "Service created successfully", _service_dict(db, service))


# ──────────────────────────────────────────────
# Update Service
# ──────────────────────────────────────────────
@router.put("/{service_id}")
async def update_service(
    service_id: str, title: Optional[str] = Form(None), description: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None), service_type_id: Optional[str] = Form(None),
    min_price: Optional[float] = Form(None), max_price: Optional[float] = Form(None),
    location: Optional[str] = Form(None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    if title is not None: service.title = title.strip()
    if description is not None: service.description = description.strip()
    if category_id is not None: service.category_id = uuid.UUID(category_id)
    if service_type_id is not None: service.service_type_id = uuid.UUID(service_type_id)
    if min_price is not None: service.min_price = min_price
    if max_price is not None: service.max_price = max_price
    if location is not None: service.location = location.strip()
    service.updated_at = datetime.now(EAT)

    db.commit()
    return standard_response(True, "Service updated successfully", _service_dict(db, service))


# ──────────────────────────────────────────────
# Delete Service
# ──────────────────────────────────────────────
@router.delete("/{service_id}")
def delete_service(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    service.is_active = False
    service.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Service deactivated successfully")


# ──────────────────────────────────────────────
# KYC VERIFICATION
# ──────────────────────────────────────────────
@router.get("/{service_id}/kyc")
def get_kyc_status(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    kyc_mappings = db.query(ServiceKYCMapping).join(KYCRequirement).filter(ServiceKYCMapping.service_type_id == service.service_type_id, KYCRequirement.is_active == True).all()

    kyc_list = []
    for mapping in kyc_mappings:
        kyc_req = mapping.kyc_requirement
        kyc_status = db.query(UserServiceKYCStatus).filter(UserServiceKYCStatus.user_service_id == service.id, UserServiceKYCStatus.kyc_requirement_id == kyc_req.id).first()
        kyc_list.append({
            "id": str(kyc_req.id), "name": kyc_req.name, "description": kyc_req.description,
            "is_mandatory": mapping.is_mandatory,
            "status": kyc_status.status.value if kyc_status else None,
            "remarks": kyc_status.remarks if kyc_status else None,
            "reviewed_at": kyc_status.reviewed_at.isoformat() if kyc_status and kyc_status.reviewed_at else None,
        })

    return standard_response(True, f"KYC requirements for '{service.title}' fetched successfully", kyc_list)


@router.post("/{service_id}/kyc")
async def upload_kyc_document(
    service_id: str, kyc_requirement_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
        krid = uuid.UUID(kyc_requirement_id)
    except ValueError:
        return standard_response(False, "Invalid service or KYC requirement ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    now = datetime.now(EAT)
    content = await file.read()
    _, ext = os.path.splitext(file.filename or "doc")
    unique_name = f"{uuid.uuid4().hex}{ext}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/kyc/{service.id}/"}, files={"file": (unique_name, content, file.content_type)}, timeout=20)

    result = resp.json()
    if not result.get("success"):
        return standard_response(False, "Failed to upload document")

    doc_url = result["data"]["url"]

    # Ensure a verification record exists for this service
    verification = db.query(UserServiceVerification).filter(
        UserServiceVerification.user_service_id == service.id,
        UserServiceVerification.submitted_by_user_id == current_user.id,
    ).first()
    if not verification:
        verification = UserServiceVerification(
            id=uuid.uuid4(), user_service_id=service.id,
            submitted_by_user_id=current_user.id,
            verification_status=VerificationStatusEnum.pending,
            created_at=now, updated_at=now,
        )
        db.add(verification)
        db.flush()

    # Store the file reference
    ver_file = UserServiceVerificationFile(
        id=uuid.uuid4(), verification_id=verification.id,
        kyc_requirement_id=krid, file_url=doc_url,
        created_at=now, updated_at=now,
    )
    db.add(ver_file)

    # Update or create KYC status
    kyc_status = db.query(UserServiceKYCStatus).filter(
        UserServiceKYCStatus.user_service_id == service.id,
        UserServiceKYCStatus.kyc_requirement_id == krid,
    ).first()
    if not kyc_status:
        kyc_status = UserServiceKYCStatus(
            id=uuid.uuid4(), user_service_id=service.id,
            kyc_requirement_id=krid, verification_id=verification.id,
            status=VerificationStatusEnum.pending,
            created_at=now, updated_at=now,
        )
        db.add(kyc_status)
    else:
        kyc_status.status = VerificationStatusEnum.pending
        kyc_status.updated_at = now

    db.commit()
    return standard_response(True, "KYC document uploaded successfully", {"file_url": doc_url})


@router.put("/{service_id}/kyc/{kyc_id}")
async def resubmit_kyc_document(service_id: str, kyc_id: str, document: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await upload_kyc_document(service_id, kyc_id, document, db, current_user)


@router.delete("/{service_id}/kyc/{kyc_id}")
def delete_kyc_document(service_id: str, kyc_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
        kid = uuid.UUID(kyc_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    kyc_status = db.query(UserServiceKYCStatus).filter(UserServiceKYCStatus.user_service_id == sid, UserServiceKYCStatus.kyc_requirement_id == kid).first()
    if kyc_status:
        db.delete(kyc_status)
        db.commit()

    return standard_response(True, "KYC document removed successfully")


# ──────────────────────────────────────────────
# PACKAGES
# ──────────────────────────────────────────────
@router.get("/{service_id}/packages")
def get_packages(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    packages = db.query(ServicePackage).filter(ServicePackage.user_service_id == sid).order_by(ServicePackage.display_order.asc()).all()
    return standard_response(True, "Packages retrieved successfully", [{"id": str(p.id), "name": p.name, "price": float(p.price) if p.price else None, "description": p.description, "features": p.features or [], "display_order": p.display_order} for p in packages])


@router.post("/{service_id}/packages")
def create_package(service_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    if not service.is_verified:
        return standard_response(False, "Only verified services can add packages")

    now = datetime.now(EAT)
    max_order = db.query(ServicePackage).filter(ServicePackage.user_service_id == sid).count()

    pkg = ServicePackage(id=uuid.uuid4(), user_service_id=sid, name=body.get("name", ""), price=body.get("price"), description=body.get("description"), features=body.get("features", []), display_order=max_order + 1, created_at=now, updated_at=now)
    db.add(pkg)
    db.commit()

    return standard_response(True, "Package created successfully", {"id": str(pkg.id), "name": pkg.name})


@router.put("/{service_id}/packages/{package_id}")
def update_package(service_id: str, package_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
        pid = uuid.UUID(package_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    pkg = db.query(ServicePackage).filter(ServicePackage.id == pid, ServicePackage.user_service_id == sid).first()
    if not pkg:
        return standard_response(False, "Package not found")

    if "name" in body: pkg.name = body["name"]
    if "price" in body: pkg.price = body["price"]
    if "description" in body: pkg.description = body["description"]
    if "features" in body: pkg.features = body["features"]
    pkg.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Package updated successfully")


@router.delete("/{service_id}/packages/{package_id}")
def delete_package(service_id: str, package_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
        pid = uuid.UUID(package_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    pkg = db.query(ServicePackage).filter(ServicePackage.id == pid, ServicePackage.user_service_id == sid).first()
    if not pkg:
        return standard_response(False, "Package not found")

    db.delete(pkg)
    db.commit()
    return standard_response(True, "Package deleted successfully")


@router.put("/{service_id}/packages/reorder")
def reorder_packages(service_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    for i, pkg_id in enumerate(body.get("order", [])):
        try:
            pkg = db.query(ServicePackage).filter(ServicePackage.id == uuid.UUID(pkg_id), ServicePackage.user_service_id == sid).first()
            if pkg:
                pkg.display_order = i + 1
        except ValueError:
            continue

    db.commit()
    return standard_response(True, "Packages reordered successfully")


# ──────────────────────────────────────────────
# IMAGES
# ──────────────────────────────────────────────
@router.post("/{service_id}/images")
async def upload_service_images(service_id: str, images: List[UploadFile] = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    now = datetime.now(EAT)
    uploaded = []
    for file in images:
        if not file or not file.filename:
            continue
        content = await file.read()
        _, ext = os.path.splitext(file.filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/services/{sid}/"}, files={"file": (unique_name, content, file.content_type)}, timeout=20)
                result = resp.json()
                if result.get("success"):
                    img = UserServiceImage(id=uuid.uuid4(), user_service_id=sid, image_url=result["data"]["url"], created_at=now)
                    db.add(img)
                    uploaded.append({"id": str(img.id), "url": result["data"]["url"]})
            except Exception:
                pass

    db.commit()
    return standard_response(True, f"{len(uploaded)} images uploaded", uploaded)


@router.delete("/{service_id}/images/{image_id}")
def delete_service_image(service_id: str, image_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
        iid = uuid.UUID(image_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    img = db.query(UserServiceImage).filter(UserServiceImage.id == iid, UserServiceImage.user_service_id == sid).first()
    if not img:
        return standard_response(False, "Image not found")

    db.delete(img)
    db.commit()
    return standard_response(True, "Image deleted successfully")


@router.put("/{service_id}/images/reorder")
def reorder_service_images(service_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    for i, img_id in enumerate(body.get("order", [])):
        try:
            img = db.query(UserServiceImage).filter(UserServiceImage.id == uuid.UUID(img_id), UserServiceImage.user_service_id == sid).first()
            if img:
                img.display_order = i + 1
        except ValueError:
            continue

    db.commit()
    return standard_response(True, "Images reordered successfully")


# ──────────────────────────────────────────────
# AVAILABILITY
# ──────────────────────────────────────────────
@router.get("/{service_id}/availability")
def get_availability(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    return standard_response(True, "Availability retrieved", {"availability": service.availability.value if hasattr(service.availability, "value") else service.availability})


@router.put("/{service_id}/availability")
def update_availability(service_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    service.availability = body.get("availability", "available")
    service.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Availability updated successfully")


# ──────────────────────────────────────────────
# BOOKINGS (Vendor View)
# ──────────────────────────────────────────────
@router.get("/{service_id}/bookings")
def get_service_bookings(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    bookings = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.user_service_id == sid).order_by(ServiceBookingRequest.created_at.desc()).all()
    data = [{
        "id": str(b.id), "event_name": b.event.name if b.event else None,
        "client_name": f"{b.client.first_name} {b.client.last_name}" if b.client else None,
        "status": b.status.value if hasattr(b.status, "value") else b.status,
        "message": b.message, "budget": float(b.budget) if b.budget else None,
        "event_date": b.event_date.isoformat() if b.event_date else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    } for b in bookings]

    return standard_response(True, "Bookings retrieved successfully", data)


@router.put("/{service_id}/bookings/{booking_id}")
def respond_to_booking(service_id: str, booking_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    booking = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not booking:
        return standard_response(False, "Booking not found")

    if "status" in body: booking.status = body["status"]
    if "response_message" in body: booking.vendor_response = body["response_message"]
    if "quoted_price" in body: booking.quoted_price = body["quoted_price"]
    booking.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Booking response recorded successfully")


# ──────────────────────────────────────────────
# REVIEWS (Vendor View)
# ──────────────────────────────────────────────
@router.get("/{service_id}/reviews")
def get_service_reviews(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    reviews = db.query(UserServiceRating).filter(UserServiceRating.user_service_id == sid).order_by(UserServiceRating.created_at.desc()).all()
    data = [{"id": str(r.id), "rating": r.rating, "comment": r.review, "user_name": f"{r.user.first_name} {r.user.last_name}" if r.user else "Anonymous", "user_avatar": r.user.profile.profile_picture_url if r.user and r.user.profile else None, "created_at": r.created_at.isoformat()} for r in reviews]

    return standard_response(True, "Reviews retrieved successfully", data)


@router.post("/{service_id}/reviews/{review_id}/reply")
def reply_to_review(service_id: str, review_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        rid = uuid.UUID(review_id)
    except ValueError:
        return standard_response(False, "Invalid review ID")

    review = db.query(UserServiceRating).filter(UserServiceRating.id == rid).first()
    if not review:
        return standard_response(False, "Review not found")

    review.vendor_reply = body.get("reply", "")
    review.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Reply posted successfully")


# ──────────────────────────────────────────────
# ANALYTICS
# ──────────────────────────────────────────────
@router.get("/{service_id}/analytics")
def get_service_analytics(service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")

    service = db.query(UserService).filter(UserService.id == sid, UserService.user_id == current_user.id).first()
    if not service:
        return standard_response(False, "Service not found")

    from sqlalchemy import func as sa_func
    total_bookings = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.user_service_id == sid).count()
    total_reviews = db.query(UserServiceRating).filter(UserServiceRating.user_service_id == sid).count()
    avg_rating = db.query(sa_func.avg(UserServiceRating.rating)).filter(UserServiceRating.user_service_id == sid).scalar() or 0

    return standard_response(True, "Analytics retrieved", {
        "total_bookings": total_bookings, "total_reviews": total_reviews,
        "average_rating": round(float(avg_rating), 1),
    })
