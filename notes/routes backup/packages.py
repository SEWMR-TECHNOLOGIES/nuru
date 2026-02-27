# backend/app/api/routes/packages.py
# MODULE 8: SERVICE PACKAGES

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models.services import ServicePackage, UserService
from models.users import User
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter()


def _package_dict(pkg: ServicePackage) -> dict:
    features = pkg.features if pkg.features else []
    return {
        "id": str(pkg.id),
        "service_id": str(pkg.user_service_id),
        "name": pkg.name,
        "description": pkg.description,
        "price": float(pkg.price),
        "features": features,
        "display_order": pkg.display_order or 0,
        "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
        "updated_at": pkg.updated_at.isoformat() if pkg.updated_at else None,
    }


# =============================================================================
# 8.1 GET /user-services/{serviceId}/packages
# =============================================================================

@router.get("/{service_id}/packages")
def list_packages(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID format.")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")
    if str(service.user_id) != str(current_user.id):
        return standard_response(False, "You do not have permission to access this service")

    packages = (
        db.query(ServicePackage)
        .filter(ServicePackage.user_service_id == sid)
        .order_by(ServicePackage.display_order.asc())
        .all()
    )

    return standard_response(True, "Packages retrieved successfully", [_package_dict(p) for p in packages])


# =============================================================================
# 8.2 POST /user-services/{serviceId}/packages — Create package
# =============================================================================

@router.post("/{service_id}/packages")
def create_package(
    service_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID format.")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")
    if str(service.user_id) != str(current_user.id):
        return standard_response(False, "You do not have permission to manage this service")

    name = body.get("name", "").strip()
    if not name:
        return standard_response(False, "Package name is required")

    price = body.get("price")
    if price is None or float(price) < 0:
        return standard_response(False, "Price must be a non-negative number")

    now = datetime.now(EAT)
    max_order = db.query(ServicePackage).filter(ServicePackage.user_service_id == sid).count()

    pkg = ServicePackage(
        id=uuid.uuid4(),
        user_service_id=sid,
        name=name,
        price=float(price),
        description=body.get("description"),
        features=body.get("features", []),
        display_order=body.get("display_order", max_order + 1),
        created_at=now,
        updated_at=now,
    )
    db.add(pkg)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to create package: {str(e)}")

    return standard_response(True, "Package created successfully", _package_dict(pkg))


# =============================================================================
# 8.3 PUT /user-services/{serviceId}/packages/{packageId}
# =============================================================================

@router.put("/{service_id}/packages/{package_id}")
def update_package(
    service_id: str,
    package_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
        pid = uuid.UUID(package_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")
    if str(service.user_id) != str(current_user.id):
        return standard_response(False, "Permission denied")

    pkg = db.query(ServicePackage).filter(ServicePackage.id == pid, ServicePackage.user_service_id == sid).first()
    if not pkg:
        return standard_response(False, "Package not found")

    now = datetime.now(EAT)

    if "name" in body:
        pkg.name = body["name"].strip()
    if "price" in body:
        pkg.price = float(body["price"])
    if "description" in body:
        pkg.description = body["description"]
    if "features" in body:
        pkg.features = body["features"]
    if "display_order" in body:
        pkg.display_order = body["display_order"]
    pkg.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to update: {str(e)}")

    return standard_response(True, "Package updated successfully", _package_dict(pkg))


# =============================================================================
# 8.4 DELETE /user-services/{serviceId}/packages/{packageId}
# =============================================================================

@router.delete("/{service_id}/packages/{package_id}")
def delete_package(
    service_id: str,
    package_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
        pid = uuid.UUID(package_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")
    if str(service.user_id) != str(current_user.id):
        return standard_response(False, "Permission denied")

    pkg = db.query(ServicePackage).filter(ServicePackage.id == pid, ServicePackage.user_service_id == sid).first()
    if not pkg:
        return standard_response(False, "Package not found")

    db.delete(pkg)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete: {str(e)}")

    return standard_response(True, "Package deleted successfully")


# =============================================================================
# 8.5 PUT /user-services/{serviceId}/packages/reorder
# =============================================================================

@router.put("/{service_id}/packages/reorder")
def reorder_packages(
    service_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID format.")

    service = db.query(UserService).filter(UserService.id == sid).first()
    if not service:
        return standard_response(False, "Service not found")
    if str(service.user_id) != str(current_user.id):
        return standard_response(False, "Permission denied")

    order_items = body.get("packages", [])
    for item in order_items:
        try:
            pid = uuid.UUID(item["package_id"])
        except (ValueError, KeyError):
            continue
        pkg = db.query(ServicePackage).filter(ServicePackage.id == pid, ServicePackage.user_service_id == sid).first()
        if pkg:
            pkg.display_order = item.get("display_order", 0)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to reorder: {str(e)}")

    return standard_response(True, "Packages reordered successfully")
