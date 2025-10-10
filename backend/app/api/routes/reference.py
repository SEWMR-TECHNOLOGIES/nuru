from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.services import ServiceCategory, ServiceType, KYCRequirement, ServiceKYCMapping
from core.database import get_db
from utils.helpers import api_response

router = APIRouter()

@router.get("/service-types")
def get_all_service_types(db: Session = Depends(get_db)):
    """
    Fetch all active service types.
    """
    service_types = db.query(ServiceType).filter(ServiceType.is_active == True).all()

    data = [
        {
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "requires_kyc": service.requires_kyc,
            "category_id": str(service.category_id) if service.category_id else None,
            "created_at": service.created_at.isoformat(),
            "updated_at": service.updated_at.isoformat(),
        }
        for service in service_types
    ]

    return api_response(True, "Service types fetched successfully.", data)

@router.get("/service-types/category/{category_id}")
def get_service_types_by_category(category_id: str, db: Session = Depends(get_db)):
    """
    Fetch all active service types for a given category ID.
    """
    # Check if category exists
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id, ServiceCategory.is_active == True).first()
    if not category:
        raise HTTPException(status_code=404, detail="Service category not found or inactive")

    service_types = db.query(ServiceType).filter(
        ServiceType.category_id == category.id,
        ServiceType.is_active == True
    ).all()

    data = [
        {
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "requires_kyc": service.requires_kyc,
            "category_id": str(service.category_id) if service.category_id else None,
            "created_at": service.created_at.isoformat(),
            "updated_at": service.updated_at.isoformat(),
        }
        for service in service_types
    ]

    return api_response(True, f"Service types fetched successfully for category '{category.name}'.", data)

@router.get("/service-categories")
def get_service_categories(db: Session = Depends(get_db)):
    """
    Fetch all active service categories.
    """
    categories = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()

    data = [
        {
            "id": str(category.id),
            "name": category.name,
            "description": category.description,
            "created_at": category.created_at.isoformat(),
            "updated_at": category.updated_at.isoformat(),
        }
        for category in categories
    ]

    return api_response(True, "Service categories fetched successfully.", data)

@router.get("/service-types/{service_type_id}/kyc")
def get_service_type_kyc(service_type_id: str, db: Session = Depends(get_db)):
    """
    Fetch all active KYC requirements for a given service type.
    """
    service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id, ServiceType.is_active == True).first()
    if not service_type:
        raise HTTPException(status_code=404, detail="Service type not found or inactive")

    kyc_mappings = (
        db.query(ServiceKYCMapping)
        .join(KYCRequirement)
        .filter(ServiceKYCMapping.service_type_id == service_type.id,
                KYCRequirement.is_active == True)
        .all()
    )

    kyc_data = [
        {
            "id": str(mapping.kyc_requirement.id),
            "name": mapping.kyc_requirement.name,
            "description": mapping.kyc_requirement.description,
            "is_mandatory": mapping.is_mandatory,
            "created_at": mapping.kyc_requirement.created_at.isoformat(),
            "updated_at": mapping.kyc_requirement.updated_at.isoformat(),
        }
        for mapping in kyc_mappings
    ]

    return api_response(True, f"KYC requirements fetched for service type '{service_type.name}'", kyc_data)
