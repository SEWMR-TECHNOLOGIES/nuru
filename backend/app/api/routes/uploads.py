# Uploads Routes - /uploads/...
# Handles file uploads (images, documents)

from fastapi import APIRouter

from models import (
    FileUpload,
    User,
)

router = APIRouter(prefix="/uploads", tags=["Uploads"])


# ──────────────────────────────────────────────
# Upload File
# ──────────────────────────────────────────────
@router.post("/")
async def upload_file():
    """Uploads a file and returns the URL."""
    pass


# ──────────────────────────────────────────────
# Upload Multiple Files
# ──────────────────────────────────────────────
@router.post("/bulk")
async def upload_files():
    """Uploads multiple files."""
    pass


# ──────────────────────────────────────────────
# Get Upload
# ──────────────────────────────────────────────
@router.get("/{upload_id}")
async def get_upload(upload_id: str):
    """Returns information about an upload."""
    pass


# ──────────────────────────────────────────────
# Delete Upload
# ──────────────────────────────────────────────
@router.delete("/{upload_id}")
async def delete_upload(upload_id: str):
    """Deletes an uploaded file."""
    pass


# ──────────────────────────────────────────────
# Get Signed Upload URL
# ──────────────────────────────────────────────
@router.post("/signed-url")
async def get_signed_upload_url():
    """Returns a pre-signed URL for direct upload."""
    pass
