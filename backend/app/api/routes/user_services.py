# User Services Routes - /user-services/...
# Handles vendor service management: CRUD, KYC verification, packages, availability, bookings

from fastapi import APIRouter

from models import (
    UserService,
    UserServiceImage,
    UserServiceVerification,
    UserServiceVerificationFile,
    UserServiceKYCStatus,
    ServicePackage,
    UserServiceRating,
    ServiceReviewHelpful,
    ServiceCategory,
    ServiceType,
    ServiceKYCMapping,
    KYCRequirement,
    ServiceBookingRequest,
)

router = APIRouter(prefix="/user-services", tags=["User Services"])


# ──────────────────────────────────────────────
# Get All My Services
# ──────────────────────────────────────────────
@router.get("/")
async def get_my_services():
    """Returns all services created by the authenticated user."""
    pass


# ──────────────────────────────────────────────
# Get Single Service
# ──────────────────────────────────────────────
@router.get("/{service_id}")
async def get_service(service_id: str):
    """Returns detailed information about a specific service."""
    pass


# ──────────────────────────────────────────────
# Create Service
# ──────────────────────────────────────────────
@router.post("/")
async def create_service():
    """Creates a new service listing."""
    pass


# ──────────────────────────────────────────────
# Update Service
# ──────────────────────────────────────────────
@router.put("/{service_id}")
async def update_service(service_id: str):
    """Updates an existing service."""
    pass


# ──────────────────────────────────────────────
# Delete Service
# ──────────────────────────────────────────────
@router.delete("/{service_id}")
async def delete_service(service_id: str):
    """Deletes a service listing."""
    pass


# ──────────────────────────────────────────────
# KYC VERIFICATION
# ──────────────────────────────────────────────
@router.get("/{service_id}/kyc")
async def get_kyc_status(service_id: str):
    """Returns KYC verification status for a service."""
    pass


@router.post("/{service_id}/kyc")
async def upload_kyc_document(service_id: str):
    """Uploads a KYC document for verification."""
    pass


@router.put("/{service_id}/kyc/{kyc_id}")
async def resubmit_kyc_document(service_id: str, kyc_id: str):
    """Resubmits a rejected KYC document."""
    pass


@router.delete("/{service_id}/kyc/{kyc_id}")
async def delete_kyc_document(service_id: str, kyc_id: str):
    """Removes a submitted KYC document."""
    pass


# ──────────────────────────────────────────────
# PACKAGES
# ──────────────────────────────────────────────
@router.get("/{service_id}/packages")
async def get_packages(service_id: str):
    """Returns all packages for a service."""
    pass


@router.post("/{service_id}/packages")
async def create_package(service_id: str):
    """Creates a new service package."""
    pass


@router.put("/{service_id}/packages/{package_id}")
async def update_package(service_id: str, package_id: str):
    """Updates an existing package."""
    pass


@router.delete("/{service_id}/packages/{package_id}")
async def delete_package(service_id: str, package_id: str):
    """Deletes a service package."""
    pass


@router.put("/{service_id}/packages/reorder")
async def reorder_packages(service_id: str):
    """Updates the display order of packages."""
    pass


# ──────────────────────────────────────────────
# IMAGES
# ──────────────────────────────────────────────
@router.post("/{service_id}/images")
async def upload_service_images(service_id: str):
    """Uploads images for a service."""
    pass


@router.delete("/{service_id}/images/{image_id}")
async def delete_service_image(service_id: str, image_id: str):
    """Deletes a service image."""
    pass


@router.put("/{service_id}/images/reorder")
async def reorder_service_images(service_id: str):
    """Reorders service images."""
    pass


# ──────────────────────────────────────────────
# AVAILABILITY
# ──────────────────────────────────────────────
@router.get("/{service_id}/availability")
async def get_availability(service_id: str):
    """Returns availability settings for a service."""
    pass


@router.put("/{service_id}/availability")
async def update_availability(service_id: str):
    """Updates availability settings."""
    pass


# ──────────────────────────────────────────────
# BOOKINGS (Vendor View)
# ──────────────────────────────────────────────
@router.get("/{service_id}/bookings")
async def get_service_bookings(service_id: str):
    """Returns all booking requests for a service."""
    pass


@router.put("/{service_id}/bookings/{booking_id}")
async def respond_to_booking(service_id: str, booking_id: str):
    """Responds to a booking request (accept/decline/quote)."""
    pass


# ──────────────────────────────────────────────
# REVIEWS (Vendor View)
# ──────────────────────────────────────────────
@router.get("/{service_id}/reviews")
async def get_service_reviews(service_id: str):
    """Returns all reviews for a service."""
    pass


@router.post("/{service_id}/reviews/{review_id}/reply")
async def reply_to_review(service_id: str, review_id: str):
    """Replies to a customer review."""
    pass


# ──────────────────────────────────────────────
# ANALYTICS
# ──────────────────────────────────────────────
@router.get("/{service_id}/analytics")
async def get_service_analytics(service_id: str):
    """Returns analytics for a service."""
    pass
