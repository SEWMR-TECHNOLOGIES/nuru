# Uploads Routes - /uploads/...

import os
import uuid
from datetime import datetime
from typing import List
import enum

import httpx
import pytz
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import FileUpload, User
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/uploads", tags=["Uploads"])


# helper to map MIME type to enum
def map_mime_to_enum(mime: str) -> str:
    if mime.startswith("image/"):
        return "image"
    elif mime == "application/pdf":
        return "pdf"
    elif mime.startswith("video/"):
        return "video"
    elif mime in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
        return "doc"
    else:
        return "doc"  # fallback for unknown types


@router.post("/")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not file or not file.filename:
        return standard_response(False, "No file provided")

    content = await file.read()
    _, ext = os.path.splitext(file.filename)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    now = datetime.now(EAT)

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/general/{current_user.id}/"}, files={"file": (unique_name, content, file.content_type)}, timeout=20)
        except Exception as e:
            return standard_response(False, f"Upload failed: {str(e)}")

    result = resp.json()
    if not result.get("success"):
        return standard_response(False, result.get("message", "Upload failed"))

    url = result["data"]["url"]
    file_enum_type = map_mime_to_enum(file.content_type)

    upload = FileUpload(id=uuid.uuid4(), user_id=current_user.id, file_url=url, original_name=file.filename, file_type=file_enum_type, file_size=len(content), created_at=now)
    db.add(upload)
    db.commit()

    return standard_response(True, "File uploaded successfully", {"id": str(upload.id), "url": url, "file_name": file.filename})


@router.post("/bulk")
async def upload_files(files: List[UploadFile] = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(EAT)
    uploaded = []

    for file in files:
        if not file or not file.filename:
            continue
        content = await file.read()
        _, ext = os.path.splitext(file.filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/general/{current_user.id}/"}, files={"file": (unique_name, content, file.content_type)}, timeout=20)
                result = resp.json()
                if result.get("success"):
                    url = result["data"]["url"]
                    file_enum_type = map_mime_to_enum(file.content_type)
                    upload = FileUpload(id=uuid.uuid4(), user_id=current_user.id, file_url=url, original_name=file.filename, file_type=file_enum_type, file_size=len(content), created_at=now)
                    db.add(upload)
                    uploaded.append({"id": str(upload.id), "url": url, "file_name": file.filename})
            except Exception:
                pass

    db.commit()
    return standard_response(True, f"{len(uploaded)} files uploaded", uploaded)


@router.get("/{upload_id}")
def get_upload(upload_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(upload_id)
    except ValueError:
        return standard_response(False, "Invalid upload ID")

    upload = db.query(FileUpload).filter(FileUpload.id == uid, FileUpload.user_id == current_user.id).first()
    if not upload:
        return standard_response(False, "Upload not found")

    return standard_response(True, "Upload retrieved", {"id": str(upload.id), "url": upload.file_url, "file_name": upload.original_name, "file_type": upload.file_type, "file_size": upload.file_size})


@router.delete("/{upload_id}")
async def delete_upload(upload_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(upload_id)
    except ValueError:
        return standard_response(False, "Invalid upload ID")

    upload = db.query(FileUpload).filter(FileUpload.id == uid, FileUpload.user_id == current_user.id).first()
    if not upload:
        return standard_response(False, "Upload not found")

    file_url = upload.file_url  # capture before delete
    db.delete(upload)
    db.commit()

    # Physically remove file from storage (best-effort)
    from utils.helpers import delete_storage_file
    await delete_storage_file(file_url)

    return standard_response(True, "Upload deleted")


@router.post("/signed-url")
def get_signed_upload_url(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Use the direct upload endpoint instead", {"upload_endpoint": "/uploads/"})
