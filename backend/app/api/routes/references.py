
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import EventType, ServiceCategory, ServiceType, KYCRequirement, ServiceKYCMapping, Currency, Country
from core.database import get_db
from utils.helpers import api_response, standard_response

router = APIRouter(prefix="/references", tags=["References"])


# ──────────────────────────────────────────────
# 2.1 Get All Event Types (cached 30 min)
# ──────────────────────────────────────────────
@router.get("/event-types")
def get_event_types(db: Session = Depends(get_db)):
    """Fetch all active event types. Cached in Redis for 30 min."""
    from core.redis import cache_get, cache_set, CacheKeys

    cached = cache_get(CacheKeys.EVENT_TYPES)
    if cached is not None:
        return standard_response(True, "Event types retrieved successfully.", cached)

    event_types = db.query(EventType).filter(EventType.is_active == True).all()
    data = [
        {
            "id": str(event.id),
            "name": event.name,
            "description": event.description,
            "icon": event.icon,
            "created_at": event.created_at.isoformat(),
            "updated_at": event.updated_at.isoformat(),
        }
        for event in event_types
    ]

    cache_set(CacheKeys.EVENT_TYPES, data, ttl_seconds=1800)  # 30 min
    return standard_response(True, "Event types retrieved successfully.", data)


# ──────────────────────────────────────────────
# 2.2 Get All Service Categories (cached 30 min)
# ──────────────────────────────────────────────
@router.get("/service-categories")
def get_service_categories(db: Session = Depends(get_db)):
    """Fetch all active service categories. Cached in Redis for 30 min."""
    from core.redis import cache_get, cache_set, CacheKeys

    cached = cache_get(CacheKeys.SERVICE_CATEGORIES)
    if cached is not None:
        return standard_response(True, "Service categories retrieved successfully.", cached)

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

    cache_set(CacheKeys.SERVICE_CATEGORIES, data, ttl_seconds=1800)
    return standard_response(True, "Service categories retrieved successfully.", data)


# ──────────────────────────────────────────────
# 2.3 Get Service Types by Category (cached 30 min)
# ──────────────────────────────────────────────
@router.get("/service-types/category/{category_id}")
def get_service_types_by_category(category_id: str, db: Session = Depends(get_db)):
    """Fetch all active service types for a given category ID."""
    from core.redis import cache_get, cache_set

    cache_key = f"ref:service_types:cat:{category_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "Service types retrieved successfully.", cached)

    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id, ServiceCategory.is_active == True).first()
    if not category:
        return standard_response(False, "Service category not found or inactive")

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

    cache_set(cache_key, data, ttl_seconds=1800)
    return standard_response(True, f"Service types retrieved successfully for category '{category.name}'.", data)


# ──────────────────────────────────────────────
# Get All Service Types (cached 30 min)
# ──────────────────────────────────────────────
@router.get("/service-types")
def get_all_service_types(db: Session = Depends(get_db)):
    """Fetch all active service types."""
    from core.redis import cache_get, cache_set

    cache_key = "ref:service_types:all"
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "Service types retrieved successfully.", cached)

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

    cache_set(cache_key, data, ttl_seconds=1800)
    return standard_response(True, "Service types retrieved successfully.", data)


# ──────────────────────────────────────────────
# 2.4 Get KYC Requirements for Service Type
# ──────────────────────────────────────────────
@router.get("/service-types/{service_type_id}/kyc")
def get_service_type_kyc(service_type_id: str, db: Session = Depends(get_db)):
    """Fetch all active KYC requirements for a given service type."""
    from core.redis import cache_get, cache_set

    cache_key = f"ref:kyc:{service_type_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "KYC requirements retrieved.", cached)

    service_type = db.query(ServiceType).filter(ServiceType.id == service_type_id, ServiceType.is_active == True).first()
    if not service_type:
        return standard_response(False, "Service type not found or inactive")

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

    cache_set(cache_key, kyc_data, ttl_seconds=1800)
    return standard_response(True, f"KYC requirements retrieved for service type '{service_type.name}'", kyc_data)


# ──────────────────────────────────────────────
# 2.5 Get All Currencies (cached 30 min)
# ──────────────────────────────────────────────
@router.get("/currencies")
def get_currencies(db: Session = Depends(get_db)):
    """Returns all supported currencies."""
    from core.redis import cache_get, cache_set

    cache_key = "ref:currencies"
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "Currencies retrieved successfully", cached)

    currencies = db.query(Currency).filter(Currency.is_active == True).all()
    data = [
        {
            "id": str(c.id),
            "code": c.code,
            "name": c.name,
            "symbol": c.symbol,
            "is_active": c.is_active
        }
        for c in currencies
    ]

    cache_set(cache_key, data, ttl_seconds=1800)
    return standard_response(True, "Currencies retrieved successfully", data)


# ──────────────────────────────────────────────
# 2.6 Get All Countries (cached 30 min)
# ──────────────────────────────────────────────
@router.get("/countries")
def get_countries(db: Session = Depends(get_db)):
    """Returns all supported countries."""
    from core.redis import cache_get, cache_set

    cache_key = "ref:countries"
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "Countries retrieved successfully", cached)

    countries = db.query(Country).filter(Country.is_active == True).all()
    data = [
        {
            "id": str(c.id),
            "code": c.code,
            "name": c.name,
            "phone_code": c.phone_code,
            "currency_id": str(c.currency_id),
            "is_active": c.is_active
        }
        for c in countries
    ]

    cache_set(cache_key, data, ttl_seconds=1800)
    return standard_response(True, "Countries retrieved successfully", data)
