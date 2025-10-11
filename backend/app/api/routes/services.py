from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, List, Optional
import httpx, pytz, uuid, os
from core.config import ALLOWED_UPLOAD_EXTENSIONS, MAX_FILES_PER_KYC, MAX_IMAGE_SIZE, MAX_KYC_FILE_SIZE, MAX_SERVICE_IMAGES, UPLOAD_SERVICE_URL,ALLOWED_IMAGE_EXTENSIONS
from models.services import KYCRequirement, UserService, UserServiceImage, UserServiceKYCStatus, UserServiceVerification, UserServiceVerificationFile
from core.database import get_db
from models.users import User
from utils.auth import get_current_user
from models.enums import ServiceAvailabilityEnum, UploadFileTypeEnum, VerificationStatusEnum 

router = APIRouter()

@router.post("/create")
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
    """Create a new user service with optional images."""

    # 1. Validate mandatory fields
    if not title.strip():
        raise HTTPException(status_code=400, detail="Service title is required.")
    if not description.strip():
        raise HTTPException(status_code=400, detail="Service description is required.")

    # 2. Prevent duplicate (same category + service type + user)
    existing_service = db.query(UserService).filter(
        UserService.user_id == current_user.id,
        UserService.category_id == category_id,
        UserService.service_type_id == service_type_id
    ).first()
    if existing_service:
        raise HTTPException(
            status_code=400,
            detail="You already created a service under this category and service type."
        )

    # 3. Validate prices
    if min_price is None or max_price is None:
        raise HTTPException(status_code=400, detail="Both minimum and maximum price are required.")
    if min_price < 0:
        raise HTTPException(status_code=400, detail="Minimum price cannot be negative.")
    if max_price < min_price:
        raise HTTPException(status_code=400, detail="Maximum price must be greater than or equal to minimum price.")

    # 4. Create the service record
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
    db.flush()  # Get ID before committing

    # 5. Handle image uploads
    uploaded_images = []
    if files:
        if len(files) > MAX_SERVICE_IMAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Only up to {MAX_SERVICE_IMAGES} images are allowed."
            )

        for file in files:
            # Validate extension
            _, ext = os.path.splitext(file.filename)
            if ext.lower() not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{file.filename}' has invalid format. Allowed formats: jpg, jpeg, png, webp."
                )

            content = await file.read()
            if len(content) > MAX_IMAGE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{file.filename}' exceeds the 0.5MB size limit."
                )

            upload_data = {"target_path": f"nuru/uploads/service-images/{new_service.id}/"}
            upload_files = {"file": (file.filename, content, file.content_type)}

            try:
                async with httpx.AsyncClient() as client:
                    upload_response = await client.post(
                        UPLOAD_SERVICE_URL,
                        data=upload_data,
                        files=upload_files,
                        timeout=20
                    )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

            if upload_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Image upload service returned an error.")

            result = upload_response.json()
            if not result.get("success"):
                raise HTTPException(
                    status_code=400,
                    detail=result.get("message", "Image upload failed")
                )

            # Save image record in DB
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

    # 6. Commit transaction
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save service: {str(e)}")

    # 7. Return response
    return {
        "success": True,
        "message": "Service created successfully.",
        "data": {
            "id": str(new_service.id),
            "title": new_service.title,
            "description": new_service.description,
            "min_price": float(new_service.min_price),
            "max_price": float(new_service.max_price),
            "verification_status": new_service.verification_status,
            "images": uploaded_images
        }
    }

@router.post("/submit-verification/{service_id}")
async def submit_service_verification(
    service_id: uuid.UUID,
    kyc_files: List[UploadFile] = File(...),
    kyc_ids: List[uuid.UUID] = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if len(kyc_files) != len(kyc_ids):
        raise HTTPException(status_code=400, detail="Mismatch between KYC IDs and uploaded files.")

    service = db.query(UserService).filter(
        UserService.id == service_id,
        UserService.user_id == current_user.id
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")

    # Fetch or create verification record for this service and user
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
        db.flush()  # get ID

    uploaded_files_data = []
    kyc_file_count: Dict[uuid.UUID, int] = {}

    for idx, file in enumerate(kyc_files):
        kyc_id = kyc_ids[idx]

        # Check if KYC requirement exists
        kyc_req = db.query(KYCRequirement).filter(KYCRequirement.id == kyc_id).first()
        if not kyc_req:
            raise HTTPException(status_code=404, detail=f"KYC requirement {kyc_id} not found.")

        # Check existing KYC status
        kyc_status = db.query(UserServiceKYCStatus).filter(
            UserServiceKYCStatus.user_service_id == service.id,
            UserServiceKYCStatus.kyc_requirement_id == kyc_id
        ).first()

        if kyc_status and kyc_status.status in [VerificationStatusEnum.pending, VerificationStatusEnum.verified]:
            raise HTTPException(
                status_code=400,
                detail=f"KYC '{kyc_req.name}' is already {kyc_status.status.value} and cannot be resubmitted."
            )

        # Increment file count per KYC
        kyc_file_count[kyc_id] = kyc_file_count.get(kyc_id, 0) + 1
        if kyc_file_count[kyc_id] > MAX_FILES_PER_KYC:
            raise HTTPException(
                status_code=400,
                detail=f"Too many files for KYC requirement {kyc_req.name}. Maximum allowed is {MAX_FILES_PER_KYC}."
            )

        # Validate file extension
        _, ext = os.path.splitext(file.filename)
        ext = ext.lower().replace(".", "")
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' has invalid format. Allowed: {', '.join(ALLOWED_UPLOAD_EXTENSIONS)}."
            )

        # Validate file size
        content = await file.read()
        if len(content) > MAX_KYC_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' exceeds max size of {MAX_KYC_FILE_SIZE / 1024 / 1024} MB."
            )

        # Upload file to storage
        upload_data = {"target_path": f"nuru/uploads/service-verifications/{service.id}/"}
        upload_files = {"file": (file.filename, content, file.content_type)}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    UPLOAD_SERVICE_URL,
                    data=upload_data,
                    files=upload_files,
                    timeout=30
                )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

        if response.status_code != 200 or not response.json().get("success"):
            raise HTTPException(status_code=500, detail=f"Upload service error: {response.text}")

        file_url = response.json()["data"]["url"]
        file_type = UploadFileTypeEnum.image if ext in ["jpg", "jpeg", "png", "webp"] else UploadFileTypeEnum.pdf

        uploaded_files_data.append({
            "kyc_id": kyc_id,
            "file_url": file_url,
            "file_type": file_type
        })

        # Update or create UserServiceKYCStatus
        if kyc_status:
            kyc_status.status = VerificationStatusEnum.pending
            kyc_status.verification_id = verification.id
            kyc_status.remarks = None
            kyc_status.reviewed_at = None
        else:
            kyc_status = UserServiceKYCStatus(
                id=uuid.uuid4(),
                user_service_id=service.id,
                kyc_requirement_id=kyc_id,
                verification_id=verification.id,
                status=VerificationStatusEnum.pending
            )
            db.add(kyc_status)

    # Save uploaded files in DB
    for file_info in uploaded_files_data:
        verification_file = UserServiceVerificationFile(
            id=uuid.uuid4(),
            verification_id=verification.id,
            kyc_requirement_id=file_info["kyc_id"],
            file_url=file_info["file_url"],
            file_type=file_info["file_type"],
            created_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
            updated_at=datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None),
        )
        db.add(verification_file)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save verification: {str(e)}")

    return {
        "success": True,
        "message": "Verification submitted successfully. Our team will review your documents within 24-48 hours.",
        "data": {
            "verification_id": str(verification.id),
            "service_id": str(service.id),
            "uploaded_files": [
                {
                    "kyc_id": str(f["kyc_id"]),
                    "file_url": f["file_url"],
                    "file_type": f["file_type"].name
                } for f in uploaded_files_data
            ]
        }
    }


