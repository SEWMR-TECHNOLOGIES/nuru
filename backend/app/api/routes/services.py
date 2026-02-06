# backend/app/api/routes/myservices.py

from fastapi import APIRouter, Depends, Form, File, UploadFile, Body
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict
import httpx, pytz, uuid, os
from core.config import (
    ALLOWED_UPLOAD_EXTENSIONS, MAX_FILES_PER_KYC, MAX_IMAGE_SIZE,
    MAX_KYC_FILE_SIZE, MAX_SERVICE_IMAGES, UPLOAD_SERVICE_URL, ALLOWED_IMAGE_EXTENSIONS
)
from models.services import (
    KYCRequirement, ServicePackage, UserService, UserServiceImage,
    UserServiceKYCStatus, UserServiceVerification, UserServiceVerificationFile
)
from core.database import get_db
from models.users import User
from utils.auth import get_current_user
from models.enums import ServiceAvailabilityEnum, UploadFileTypeEnum, VerificationStatusEnum
from utils.helpers import standard_response
from pydantic import BaseModel

router = APIRouter()


# ============================================================================
# CREATE SERVICE — POST /user-services/
# ============================================================================
@router.post("/")
async def create_user_service(
    category_id: uuid.UUID = Form(...),
    service_type_id: uuid.UUID = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    min_price: float = Form(...),
    max_price: float = Form(...),
    location: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        if not title.strip():
            return standard_response(False, "Service title is required.")
        if not description.strip():
            return standard_response(False, "Service description is required.")

        existing_service = db.query(UserService).filter(
            UserService.user_id == current_user.id,
            UserService.category_id == category_id,
            UserService.service_type_id == service_type_id
        ).first()
        if existing_service:
            return standard_response(False, "You already created a service under this category and service type.")

        if min_price is None or max_price is None:
            return standard_response(False, "Both minimum and maximum price are required.")
        if min_price < 0:
            return standard_response(False, "Minimum price cannot be negative.")
        if max_price < min_price:
            return standard_response(False, "Maximum price must be greater than or equal to minimum price.")

        new_service = UserService(
            id=uuid.uuid4(),
            user_id=current_user.id,
            category_id=category_id,
            service_type_id=service_type_id,
            title=title.strip(),
            description=description.strip(),
            min_price=min_price,
            max_price=max_price,
            location=location.strip() if location else None,
            verification_status=VerificationStatusEnum.pending,
            availability=ServiceAvailabilityEnum.available,
            is_verified=False,
            is_active=True,
            created_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
            updated_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
        )
        db.add(new_service)
        db.flush()

        uploaded_images = []
        if files:
            if len(files) > MAX_SERVICE_IMAGES:
                return standard_response(False, f"Only up to {MAX_SERVICE_IMAGES} images are allowed.")

            for file in files:
                _, ext = os.path.splitext(file.filename)
                ext = ext.lower().replace(".", "")
                if ext not in ALLOWED_IMAGE_EXTENSIONS:
                    return standard_response(False, f"File '{file.filename}' has invalid format. Allowed formats: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}.")

                content = await file.read()
                if len(content) > MAX_IMAGE_SIZE:
                    return standard_response(False, f"File '{file.filename}' exceeds the 0.5MB size limit.")

                upload_data = {"target_path": f"nuru/uploads/service-images/{new_service.id}/"}
                upload_files = {"file": (file.filename, content, file.content_type)}

                try:
                    async with httpx.AsyncClient() as client:
                        upload_response = await client.post(
                            UPLOAD_SERVICE_URL, data=upload_data, files=upload_files, timeout=20
                        )
                except Exception as e:
                    return standard_response(False, f"Image upload failed: {str(e)}")

                if upload_response.status_code != 200:
                    return standard_response(False, "Image upload service returned an error.")

                result = upload_response.json()
                if not result.get("success"):
                    return standard_response(False, result.get("message", "Image upload failed"))

                image_url = result["data"]["url"]
                image_record = UserServiceImage(
                    id=uuid.uuid4(),
                    user_service_id=new_service.id,
                    image_url=image_url,
                    description=None,
                    is_featured=False,
                    created_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
                    updated_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
                )
                db.add(image_record)
                uploaded_images.append(image_url)

        db.commit()
        db.refresh(new_service)

        return standard_response(True, "Service created successfully.", {
            "id": str(new_service.id),
            "title": new_service.title,
            "description": new_service.description,
            "min_price": float(new_service.min_price),
            "max_price": float(new_service.max_price),
            "verification_status": new_service.verification_status.name,
            "images": uploaded_images
        })
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to create service: {str(e)}")


# ============================================================================
# UPLOAD KYC DOCUMENT — POST /user-services/{service_id}/kyc
# (Single file per request, matching frontend userServicesApi.uploadKyc)
# ============================================================================
@router.post("/{service_id}/kyc")
async def upload_kyc_document(
    service_id: uuid.UUID,
    file: UploadFile = File(...),
    kyc_requirement_id: uuid.UUID = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        service = db.query(UserService).filter(
            UserService.id == service_id,
            UserService.user_id == current_user.id
        ).first()
        if not service:
            return standard_response(False, "Service not found.")

        kyc_req = db.query(KYCRequirement).filter(KYCRequirement.id == kyc_requirement_id).first()
        if not kyc_req:
            return standard_response(False, "KYC requirement not found.")

        kyc_status = db.query(UserServiceKYCStatus).filter(
            UserServiceKYCStatus.user_service_id == service.id,
            UserServiceKYCStatus.kyc_requirement_id == kyc_requirement_id
        ).first()

        if kyc_status and kyc_status.status in [VerificationStatusEnum.pending, VerificationStatusEnum.verified]:
            return standard_response(False, f"KYC '{kyc_req.name}' is already {kyc_status.status.value} and cannot be resubmitted.")

        _, ext = os.path.splitext(file.filename)
        ext = ext.lower().replace(".", "")
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            return standard_response(False, f"File '{file.filename}' has invalid format. Allowed: {', '.join(ALLOWED_UPLOAD_EXTENSIONS)}.")

        content = await file.read()
        if len(content) > MAX_KYC_FILE_SIZE:
            return standard_response(False, f"File '{file.filename}' exceeds max size of {MAX_KYC_FILE_SIZE / 1024 / 1024} MB.")

        upload_data = {"target_path": f"nuru/uploads/service-verifications/{service.id}/"}
        upload_files = {"file": (file.filename, content, file.content_type)}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    UPLOAD_SERVICE_URL, data=upload_data, files=upload_files, timeout=30
                )
        except Exception as e:
            return standard_response(False, f"File upload failed: {str(e)}")

        if response.status_code != 200 or not response.json().get("success"):
            return standard_response(False, f"Upload service error: {response.text}")

        file_url = response.json()["data"]["url"]
        file_type = UploadFileTypeEnum.image if ext in ["jpg", "jpeg", "png", "webp"] else UploadFileTypeEnum.pdf

        # Get or create verification record
        verification = db.query(UserServiceVerification).filter(
            UserServiceVerification.user_service_id == service.id,
            UserServiceVerification.submitted_by_user_id == current_user.id
        ).first()
        if not verification:
            verification = UserServiceVerification(
                id=uuid.uuid4(),
                user_service_id=service.id,
                submitted_by_user_id=current_user.id,
                verification_status=VerificationStatusEnum.pending,
                created_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
                updated_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
            )
            db.add(verification)
            db.flush()

        # Update or create KYC status
        if kyc_status:
            kyc_status.status = VerificationStatusEnum.pending
            kyc_status.verification_id = verification.id
            kyc_status.remarks = None
            kyc_status.reviewed_at = None
        else:
            kyc_status = UserServiceKYCStatus(
                id=uuid.uuid4(),
                user_service_id=service.id,
                kyc_requirement_id=kyc_requirement_id,
                verification_id=verification.id,
                status=VerificationStatusEnum.pending
            )
            db.add(kyc_status)

        # Save verification file record
        verification_file = UserServiceVerificationFile(
            id=uuid.uuid4(),
            verification_id=verification.id,
            kyc_requirement_id=kyc_requirement_id,
            file_url=file_url,
            file_type=file_type,
            created_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
            updated_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
        )
        db.add(verification_file)

        db.commit()

        return standard_response(True, "KYC document uploaded successfully.", {
            "id": str(verification_file.id),
            "kyc_requirement_id": str(kyc_requirement_id),
            "file_url": file_url,
            "status": "pending"
        })

    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to upload KYC document: {str(e)}")


# ============================================================================
# DELETE KYC DOCUMENT — DELETE /user-services/{service_id}/kyc/{kyc_id}
# ============================================================================
@router.delete("/{service_id}/kyc/{kyc_id}")
async def delete_kyc_document(
    service_id: uuid.UUID,
    kyc_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        service = db.query(UserService).filter(
            UserService.id == service_id,
            UserService.user_id == current_user.id
        ).first()
        if not service:
            return standard_response(False, "Service not found.")

        verification_file = db.query(UserServiceVerificationFile).filter(
            UserServiceVerificationFile.id == kyc_id
        ).first()
        if not verification_file:
            return standard_response(False, "KYC document not found.")

        db.delete(verification_file)
        db.commit()

        return standard_response(True, "KYC document deleted successfully.")
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete KYC document: {str(e)}")


# ============================================================================
# SUBMIT FOR VERIFICATION — POST /user-services/{service_id}/verify
# ============================================================================
@router.post("/{service_id}/verify")
async def submit_for_verification(
    service_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        service = db.query(UserService).filter(
            UserService.id == service_id,
            UserService.user_id == current_user.id
        ).first()
        if not service:
            return standard_response(False, "Service not found.")

        verification = db.query(UserServiceVerification).filter(
            UserServiceVerification.user_service_id == service.id,
            UserServiceVerification.submitted_by_user_id == current_user.id
        ).first()
        if not verification:
            return standard_response(False, "No KYC documents uploaded yet. Please upload required documents first.")

        verification.verification_status = VerificationStatusEnum.pending
        verification.updated_at = datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None)

        service.verification_status = VerificationStatusEnum.pending
        service.updated_at = datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None)

        db.commit()

        return standard_response(True, "Verification submitted successfully. Our team will review your documents within 24-48 hours.", {
            "service_id": str(service.id),
            "verification_status": "pending",
            "submitted_at": verification.updated_at.isoformat()
        })
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to submit verification: {str(e)}")


# ============================================================================
# ADD PACKAGE — POST /user-services/{service_id}/packages (JSON body)
# ============================================================================
class PackageCreateRequest(BaseModel):
    name: str
    description: str
    features: List[str]
    price: float


@router.post("/{service_id}/packages")
async def create_service_package(
    service_id: uuid.UUID,
    data: PackageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        service = db.query(UserService).filter(
            UserService.id == service_id,
            UserService.user_id == current_user.id
        ).first()
        if not service:
            return standard_response(False, "We could not find this service in your account.")
        if service.verification_status != VerificationStatusEnum.verified:
            return standard_response(False, "You can only add packages to verified services.")
        if not data.name.strip():
            return standard_response(False, "Please provide a package name.")
        if not data.description.strip():
            return standard_response(False, "Please include a brief description of this package.")
        if data.price <= 0:
            return standard_response(False, "Please enter a valid package price greater than zero.")
        if not data.features:
            return standard_response(False, "Please add at least one feature for this package.")

        package = ServicePackage(
            id=uuid.uuid4(),
            user_service_id=service_id,
            name=data.name.strip(),
            description=data.description.strip(),
            price=data.price,
            features=data.features,
            created_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
            updated_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
        )
        db.add(package)
        db.commit()
        db.refresh(package)

        return standard_response(True, "Your service package was added successfully.", {
            "id": str(package.id),
            "service_id": str(service.id),
            "name": package.name,
            "description": package.description,
            "price": float(package.price),
            "features": package.features,
            "created_at": package.created_at.isoformat()
        })
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to create package: {str(e)}")
