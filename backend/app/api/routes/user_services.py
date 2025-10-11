from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from models.services import KYCRequirement, ServiceKYCMapping, UserService, UserServiceKYCStatus
from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response, format_price
from models.users import User
from models.enums import VerificationStatusEnum
import uuid

router = APIRouter()

@router.get("/{service_id}/kyc")
def get_user_service_kyc(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all KYC requirements for a given user's service with their status and remarks.
    """
    # Verify the service belongs to the current user
    service = db.query(UserService).filter(
        UserService.id == service_id,
        UserService.user_id == current_user.id
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found or does not belong to the user.")

    # Get KYC requirements mapped to the service type
    kyc_mappings = (
        db.query(ServiceKYCMapping)
        .join(KYCRequirement)
        .filter(
            ServiceKYCMapping.service_type_id == service.service_type_id,
            KYCRequirement.is_active == True
        )
        .all()
    )

    kyc_list = []
    for mapping in kyc_mappings:
        kyc_req = mapping.kyc_requirement

        # Fetch KYC status for this service and requirement
        kyc_status = db.query(UserServiceKYCStatus).filter(
            UserServiceKYCStatus.user_service_id == service.id,
            UserServiceKYCStatus.kyc_requirement_id == kyc_req.id
        ).first()

        kyc_list.append({
            "id": str(kyc_req.id),
            "name": kyc_req.name,
            "description": kyc_req.description,
            "is_mandatory": mapping.is_mandatory,
            "status": kyc_status.status.value if kyc_status else None,
            "remarks": kyc_status.remarks if kyc_status else None,
            "reviewed_at": kyc_status.reviewed_at.isoformat() if kyc_status and kyc_status.reviewed_at else None,
            "created_at": kyc_req.created_at.isoformat(),
            "updated_at": kyc_req.updated_at.isoformat(),
        })

    return api_response(
        success=True,
        message=f"KYC requirements for service '{service.title}' fetched successfully.",
        data=kyc_list
    )

@router.get("/")
def get_user_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all services for the current user with details, service type,
    images, ratings, and calculated verification progress based on KYC status.
    """
    services = db.query(UserService).filter(UserService.user_id == current_user.id).all()
    response_data = []

    for service in services:
        # Fetch images
        images = [img.image_url for img in service.images]

        # Calculate average rating
        ratings = [r.rating for r in service.ratings]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0
        review_count = len(ratings)

        # Fetch KYC mappings for service type
        kyc_mappings = (
            db.query(ServiceKYCMapping)
            .filter(ServiceKYCMapping.service_type_id == service.service_type_id)
            .all()
        )

        # Calculate verified KYC count
        verified_count = 0
        kyc_status_list = []

        for mapping in kyc_mappings:
            kyc_req = mapping.kyc_requirement
            kyc_status = (
                db.query(UserServiceKYCStatus)
                .filter(
                    UserServiceKYCStatus.user_service_id == service.id,
                    UserServiceKYCStatus.kyc_requirement_id == kyc_req.id,
                )
                .first()
            )
            status = kyc_status.status if kyc_status else None
            if status == VerificationStatusEnum.verified:
                verified_count += 1

            kyc_status_list.append({
                "id": str(kyc_req.id),
                "name": kyc_req.name,
                "description": kyc_req.description,
                "is_mandatory": mapping.is_mandatory,
                "status": status.value if status else None,
                "remarks": kyc_status.remarks if kyc_status else None
            })

        # Calculate verification progress
        total_kyc = len(kyc_mappings)
        verification_progress = int((verified_count / total_kyc) * 100) if total_kyc > 0 else 0

        # Add service type details
        service_type_name = service.service_type.name if service.service_type else None

        response_data.append({
            "id": str(service.id),
            "title": service.title,
            "category": service.category.name if service.category else None,
            "description": service.description,
            "basePrice": service.min_price,
            "price": f"{format_price(service.min_price)} - {format_price(service.max_price)}" if service.min_price and service.max_price else None,
            "rating": avg_rating,
            "reviewCount": review_count,
            "isVerified": service.is_verified,
            "verificationProgress": verification_progress,
            "verificationStatus": service.verification_status.value,
            "images": images,
            "pastEvents": service.past_events if hasattr(service, "past_events") else 0,
            "availability": service.availability.value if service.availability else "Available",
            "location": service.location,
            "kycList": kyc_status_list,
            "serviceTypeId": str(service.service_type_id) if service.service_type_id else None,
            "serviceTypeName": service_type_name,
        })

    return api_response(
        success=True,
        message="User services fetched successfully.",
        data=response_data
    )

@router.get("/{service_id}")
def get_user_service_details(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch detailed information for a single user's service,
    including category, type, images, KYC status, ratings, verification progress,
    packages, past events, and reviews.
    """
    # Verify ownership
    service = db.query(UserService).filter(
        UserService.id == service_id,
        UserService.user_id == current_user.id
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found or does not belong to the user.")

    # Images
    images = [img.image_url for img in service.images]

    # Ratings
    ratings = service.ratings
    avg_rating = round(sum(r.rating for r in ratings) / len(ratings), 1) if ratings else 0
    review_count = len(ratings)
    reviews_list = [
        {
            "id": str(r.id),
            "clientName": r.user.full_name if hasattr(r, "user") else "Anonymous",
            "rating": r.rating,
            "comment": r.review,
            "date": r.created_at.isoformat(),
            "eventType": r.review_event_type if hasattr(r, "review_event_type") else "N/A"
        }
        for r in ratings
    ]

    # KYC
    kyc_mappings = db.query(ServiceKYCMapping).filter(ServiceKYCMapping.service_type_id == service.service_type_id).all()
    verified_count = 0
    kyc_status_list = []
    for mapping in kyc_mappings:
        kyc_req = mapping.kyc_requirement
        kyc_status = db.query(UserServiceKYCStatus).filter(
            UserServiceKYCStatus.user_service_id == service.id,
            UserServiceKYCStatus.kyc_requirement_id == kyc_req.id
        ).first()
        status = kyc_status.status if kyc_status else None
        if status == VerificationStatusEnum.verified:
            verified_count += 1
        kyc_status_list.append({
            "id": str(kyc_req.id),
            "name": kyc_req.name,
            "description": kyc_req.description,
            "is_mandatory": mapping.is_mandatory,
            "status": status.value if status else None,
            "remarks": kyc_status.remarks if kyc_status else None,
            "reviewed_at": kyc_status.reviewed_at.isoformat() if kyc_status and kyc_status.reviewed_at else None
        })

    total_kyc = len(kyc_mappings)
    verification_progress = int((verified_count / total_kyc) * 100) if total_kyc > 0 else 0

    # Packages
    packages_list = [
        {
            "id": str(pkg.id),
            "name": pkg.name,
            "price": pkg.price,
            "description": pkg.description,
            "features": pkg.features if pkg.features else []
        }
        for pkg in getattr(service, "packages", [])
    ]

    # Past events placeholder (if using a separate table, join it instead)
    past_events_list = getattr(service, "past_events", [])

    response_data = {
        "id": str(service.id),
        "title": service.title,
        "category": service.category.name if service.category else None,
        "categoryId": str(service.category_id) if service.category_id else None,
        "description": service.description,
        "basePrice": service.min_price,
        "price": f"{format_price(service.min_price)} - {format_price(service.max_price)}" if service.min_price and service.max_price else None,
        "rating": avg_rating,
        "reviewCount": review_count,
        "isVerified": service.is_verified,
        "verificationProgress": verification_progress,
        "verificationStatus": service.verification_status.value,
        "images": images,
        "pastEvents": past_events_list,
        "availability": service.availability.value if service.availability else "Available",
        "location": service.location,
        "kycList": kyc_status_list,
        "serviceTypeId": str(service.service_type_id) if service.service_type_id else None,
        "serviceTypeName": service.service_type.name if service.service_type else None,
        "reviews": reviews_list,
        "packages": packages_list
    }

    return api_response(
        success=True,
        message=f"Service '{service.title}' details fetched successfully.",
        data=response_data
    )

