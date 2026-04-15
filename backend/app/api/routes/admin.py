"""
Admin Routes - /admin/...
Uses a completely separate admin_users table. Regular Nuru users can NEVER
access the admin panel. Admin authentication is fully server-side.
"""

import hashlib
import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body, Query, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, desc

from core.database import get_db
from models import (
    AdminUser, AdminRoleEnum, NameValidationFlag,
    User, UserProfile, UserService, UserServiceVerification, UserServiceVerificationFile,
    UserServiceKYCStatus, KYCRequirement, ServiceKYCMapping, LiveChatSession, LiveChatMessage,
    SupportTicket, SupportMessage, FAQ,
    EventType, ServiceCategory, ServiceType,
    Event, EventContribution, EventContributor,
    Notification,
    UserFeed, UserFeedImage, UserFeedComment, UserFeedGlow, UserFeedEcho,
    UserMoment,
    Community, CommunityMember, CommunityPost,
    EventCommitteeMember,
    EventImage, EventScheduleItem,
    EventInvitation,
    UserIdentityVerification,
    IdentityDocumentRequirement,
    ServiceBookingRequest,
    NuruCardOrder,
    ContentAppeal,
    IssueCategory, Issue, IssueResponse, IssueStatusEnum, IssuePriorityEnum,
    AgreementVersion, UserAgreementAcceptance,
    EventTicketClass, EventTicket,
    TicketApprovalStatusEnum, TicketOrderStatusEnum,
)
from models.enums import VerificationStatusEnum, ChatSessionStatusEnum, NotificationTypeEnum, EventStatusEnum, AppealStatusEnum, AppealContentTypeEnum, CardOrderStatusEnum, AgreementTypeEnum
from utils.auth import create_access_token, create_refresh_token, verify_refresh_token
from utils.helpers import standard_response, paginate
import jwt
from core.config import SECRET_KEY, ALGORITHM

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/admin", tags=["Admin"])


# ──────────────────────────────────────────────
# Admin JWT helpers
# ──────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def _get_admin_from_token(token: str, db: Session) -> AdminUser:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        admin_id = payload.get("admin_id")
        is_admin_token = payload.get("is_admin", False)
        if not admin_id or not is_admin_token:
            raise HTTPException(status_code=403, detail="Not an admin token")
        admin = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
        if not admin or not admin.is_active:
            raise HTTPException(status_code=403, detail="Admin account inactive or not found")
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Admin token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid admin token")


def require_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    """Gate: only valid AdminUser JWT tokens pass through."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing")
    token = auth_header.split(" ", 1)[1]
    admin = _get_admin_from_token(token, db)
    return admin


def require_super_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    """Gate: only 'admin' role can perform destructive operations."""
    admin = require_admin(request, db)
    if admin.role != AdminRoleEnum.admin:
        raise HTTPException(status_code=403, detail="Super-admin (admin role) required")
    return admin


# ──────────────────────────────────────────────
# ADMIN LOGIN  (POST /admin/auth/login)
# ──────────────────────────────────────────────

@router.post("/auth/login")
async def admin_login(request: Request, db: Session = Depends(get_db)):
    """Separate admin login — only admin_users table is checked."""
    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Invalid request body.")

    credential = (payload.get("credential") or "").strip()
    password = payload.get("password", "")

    if not credential or not password:
        return standard_response(False, "Credential and password are required.")

    admin = db.query(AdminUser).filter(
        or_(AdminUser.email == credential, AdminUser.username == credential)
    ).first()

    if not admin or admin.password_hash != _hash_password(password):
        return standard_response(False, "Invalid credentials.")

    if not admin.is_active:
        return standard_response(False, "Your admin account has been deactivated.")

    # Stamp last login
    admin.last_login_at = datetime.utcnow()
    db.commit()

    access_token = create_access_token({
        "admin_id": str(admin.id),
        "is_admin": True,
        "role": admin.role.value,
    })
    refresh_token = create_refresh_token({
        "admin_id": str(admin.id),
        "is_admin": True,
    })

    return standard_response(True, "Admin login successful", {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "admin": {
            "id": str(admin.id),
            "full_name": admin.full_name,
            "email": admin.email,
            "username": admin.username,
            "role": admin.role.value,
        }
    })


# ──────────────────────────────────────────────
# ADMIN REFRESH TOKEN  (POST /admin/auth/refresh)
# ──────────────────────────────────────────────

@router.post("/auth/refresh")
async def admin_refresh(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        return standard_response(False, "Invalid request body.")
    token = body.get("refresh_token")
    if not token:
        return standard_response(False, "Refresh token required.")
    payload = verify_refresh_token(token)
    if not payload or not payload.get("is_admin"):
        return standard_response(False, "Invalid or expired refresh token.")
    admin_id = payload.get("admin_id")
    new_access = create_access_token({"admin_id": admin_id, "is_admin": True, "role": payload.get("role", "support")})
    new_refresh = create_refresh_token({"admin_id": admin_id, "is_admin": True})
    return standard_response(True, "Token refreshed", {"access_token": new_access, "refresh_token": new_refresh})




# ──────────────────────────────────────────────
# DASHBOARD STATS
# ──────────────────────────────────────────────

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_events = db.query(func.count(Event.id)).scalar() or 0
    total_services = db.query(func.count(UserService.id)).scalar() or 0
    pending_kyc = db.query(func.count(UserServiceVerification.id)).filter(
        UserServiceVerification.verification_status == VerificationStatusEnum.pending
    ).scalar() or 0
    open_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == 'open').scalar() or 0
    active_chats = db.query(func.count(LiveChatSession.id)).filter(
        LiveChatSession.status == ChatSessionStatusEnum.active
    ).scalar() or 0
    waiting_chats = db.query(func.count(LiveChatSession.id)).filter(
        LiveChatSession.status == ChatSessionStatusEnum.waiting
    ).scalar() or 0

    return standard_response(True, "Dashboard stats", {
        "total_users": total_users,
        "total_events": total_events,
        "total_services": total_services,
        "pending_kyc": pending_kyc,
        "open_tickets": open_tickets,
        "active_chats": active_chats,
        "waiting_chats": waiting_chats,
    })


# ──────────────────────────────────────────────
# USER MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/users")
def list_users(
    page: int = 1, limit: int = 20,
    q: str = None,
    is_active: bool = None,
    is_vendor: bool = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(User).options(joinedload(User.profile))
    if q:
        search = f"%{q}%"
        query = query.filter(or_(
            User.first_name.ilike(search),
            User.last_name.ilike(search),
            User.email.ilike(search),
            User.username.ilike(search),
            User.phone.ilike(search),
        ))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    query = query.order_by(User.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for u in items:
        avatar = None
        if u.profile:
            avatar = u.profile.profile_picture_url
        is_vendor = bool(u.user_services) if hasattr(u, 'user_services') else False
        data.append({
            "id": str(u.id),
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "email": u.email,
            "phone": u.phone,
            "avatar": avatar,
            "is_active": u.is_active,
            "is_suspended": getattr(u, 'is_suspended', False),
            "suspension_reason": getattr(u, 'suspension_reason', None),
            "is_email_verified": u.is_email_verified,
            "is_phone_verified": u.is_phone_verified,
            "is_identity_verified": u.is_identity_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return standard_response(True, "Users retrieved", data, pagination=pagination)


@router.get("/users/{user_id}")
def get_user_detail(user_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    user = db.query(User).options(joinedload(User.profile)).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    avatar = user.profile.profile_picture_url if user.profile else None
    service_count = db.query(func.count(UserService.id)).filter(UserService.user_id == uid).scalar() or 0
    event_count = db.query(func.count(Event.id)).filter(Event.organizer_id == uid).scalar() or 0
    return standard_response(True, "User retrieved", {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "avatar": avatar,
        "bio": user.profile.bio if user.profile else None,
        "location": user.profile.location if user.profile else None,
        "is_active": user.is_active,
        "is_suspended": getattr(user, 'is_suspended', False),
        "suspension_reason": getattr(user, 'suspension_reason', None),
        "is_email_verified": user.is_email_verified,
        "is_phone_verified": user.is_phone_verified,
        "is_identity_verified": user.is_identity_verified,
        "service_count": service_count,
        "event_count": event_count,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    })


@router.put("/users/{user_id}/activate")
def activate_user(user_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    user.is_active = True
    user.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "User activated")


@router.put("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    user.is_active = False
    user.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "User deactivated")


@router.put("/users/{user_id}/reset-password")
def reset_user_password(user_id: str, request_data: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    """Admin resets a Nuru user's password."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    new_password = request_data.get("new_password", "")
    if not new_password or len(new_password) < 8:
        return standard_response(False, "Password must be at least 8 characters")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    user.password_hash = _hash_password(new_password)
    user.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Password reset successfully")


# ──────────────────────────────────────────────
# ADMIN ACCOUNT MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/admins")
def list_admins(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    """List all admin accounts. Only accessible to admin role."""
    admins = db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()
    data = []
    for a in admins:
        data.append({
            "id": str(a.id),
            "full_name": a.full_name,
            "email": a.email,
            "username": a.username,
            "role": a.role.value,
            "is_active": a.is_active,
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return standard_response(True, "Admins retrieved", data)


@router.post("/admins")
def create_admin(request_data: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    """Create a new admin account. Only the admin role can do this."""
    if admin.role != AdminRoleEnum.admin:
        raise HTTPException(status_code=403, detail="Only admins can create admin accounts")
    full_name = (request_data.get("full_name") or "").strip()
    email = (request_data.get("email") or "").strip().lower()
    username = (request_data.get("username") or "").strip().lower()
    password = request_data.get("password", "")
    role_str = request_data.get("role", "support")

    if not full_name or not email or not username or not password:
        return standard_response(False, "All fields are required")
    if len(password) < 8:
        return standard_response(False, "Password must be at least 8 characters")

    try:
        role = AdminRoleEnum(role_str)
    except ValueError:
        return standard_response(False, f"Invalid role. Must be one of: {[r.value for r in AdminRoleEnum]}")

    # Check uniqueness
    if db.query(AdminUser).filter(AdminUser.email == email).first():
        return standard_response(False, "Email already in use")
    if db.query(AdminUser).filter(AdminUser.username == username).first():
        return standard_response(False, "Username already in use")

    new_admin = AdminUser(
        full_name=full_name,
        email=email,
        username=username,
        password_hash=_hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(new_admin)
    db.commit()
    return standard_response(True, "Admin account created", {
        "id": str(new_admin.id),
        "full_name": new_admin.full_name,
        "email": new_admin.email,
        "username": new_admin.username,
        "role": new_admin.role.value,
    })


@router.put("/admins/{admin_id}/activate")
def activate_admin(admin_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    if admin.role != AdminRoleEnum.admin:
        raise HTTPException(status_code=403, detail="Only admins can manage admin accounts")
    try:
        aid = uuid.UUID(admin_id)
    except ValueError:
        return standard_response(False, "Invalid admin ID")
    target = db.query(AdminUser).filter(AdminUser.id == aid).first()
    if not target:
        return standard_response(False, "Admin not found")
    target.is_active = True
    db.commit()
    return standard_response(True, "Admin activated")


@router.put("/admins/{admin_id}/deactivate")
def deactivate_admin(admin_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    if admin.role != AdminRoleEnum.admin:
        raise HTTPException(status_code=403, detail="Only admins can manage admin accounts")
    try:
        aid = uuid.UUID(admin_id)
    except ValueError:
        return standard_response(False, "Invalid admin ID")
    if str(admin.id) == admin_id:
        return standard_response(False, "You cannot deactivate your own account")
    target = db.query(AdminUser).filter(AdminUser.id == aid).first()
    if not target:
        return standard_response(False, "Admin not found")
    target.is_active = False
    db.commit()
    return standard_response(True, "Admin deactivated")


@router.delete("/admins/{admin_id}")
def delete_admin(admin_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    if admin.role != AdminRoleEnum.admin:
        raise HTTPException(status_code=403, detail="Only admins can delete admin accounts")
    try:
        aid = uuid.UUID(admin_id)
    except ValueError:
        return standard_response(False, "Invalid admin ID")
    if str(admin.id) == admin_id:
        return standard_response(False, "You cannot delete your own account")
    target = db.query(AdminUser).filter(AdminUser.id == aid).first()
    if not target:
        return standard_response(False, "Admin not found")
    db.delete(target)
    db.commit()
    return standard_response(True, "Admin account deleted")


# ──────────────────────────────────────────────
# KYC / SERVICE VERIFICATION
# ──────────────────────────────────────────────


@router.get("/kyc")
def list_kyc_submissions(
    page: int = 1, limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(UserServiceVerification).options(
        joinedload(UserServiceVerification.user_service).joinedload(UserService.user).joinedload(User.profile),
        joinedload(UserServiceVerification.kyc_statuses).joinedload(UserServiceKYCStatus.kyc_requirement),
    )
    if status:
        try:
            status_enum = VerificationStatusEnum(status)
            query = query.filter(UserServiceVerification.verification_status == status_enum)
        except ValueError:
            pass
    query = query.order_by(UserServiceVerification.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for v in items:
        service = v.user_service
        user = service.user if service else None
        profile = user.profile if user else None
        # Build per-item KYC status list
        kyc_items = []
        for ks in (v.kyc_statuses or []):
            req = ks.kyc_requirement
            kyc_items.append({
                "id": str(ks.id),
                "kyc_requirement_id": str(ks.kyc_requirement_id) if ks.kyc_requirement_id else None,
                "name": req.name if req else None,
                "description": req.description if req else None,
                "status": ks.status.value if ks.status else "pending",
                "remarks": ks.remarks,
            })
        data.append({
            "id": str(v.id),
            "service_id": str(v.user_service_id) if v.user_service_id else None,
            "service_name": service.title if service else None,
            "status": v.verification_status.value if v.verification_status else None,
            "notes": v.remarks,
            "submitted_at": v.created_at.isoformat() if v.created_at else None,
            "kyc_items": kyc_items,
            "user": {
                "id": str(user.id) if user else None,
                "name": f"{user.first_name} {user.last_name}".strip() if user else None,
                "email": user.email if user else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if user else None,
        })
    return standard_response(True, "KYC submissions retrieved", data, pagination=pagination)


@router.get("/kyc/{verification_id}")
def get_kyc_detail(verification_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        vid = uuid.UUID(verification_id)
    except ValueError:
        return standard_response(False, "Invalid verification ID")
    v = db.query(UserServiceVerification).options(
        joinedload(UserServiceVerification.user_service).joinedload(UserService.user).joinedload(User.profile),
        joinedload(UserServiceVerification.files).joinedload(UserServiceVerificationFile.kyc_requirement),
        joinedload(UserServiceVerification.kyc_statuses).joinedload(UserServiceKYCStatus.kyc_requirement),
    ).filter(UserServiceVerification.id == vid).first()
    if not v:
        return standard_response(False, "Verification not found")
    
    service = v.user_service
    user = service.user if service else None
    profile = user.profile if user else None
    doc_files = []
    for f in (v.files or []):
        req = f.kyc_requirement
        doc_files.append({
            "id": str(f.id),
            "file_url": f.file_url,
            "kyc_requirement_id": str(f.kyc_requirement_id) if f.kyc_requirement_id else None,
            "kyc_name": req.name if req else None,
            "uploaded_at": f.created_at.isoformat() if f.created_at else None,
        })
    kyc_items = []
    for ks in (v.kyc_statuses or []):
        req = ks.kyc_requirement
        kyc_items.append({
            "id": str(ks.id),
            "kyc_requirement_id": str(ks.kyc_requirement_id) if ks.kyc_requirement_id else None,
            "name": req.name if req else None,
            "description": req.description if req else None,
            "status": ks.status.value if ks.status else "pending",
            "remarks": ks.remarks,
        })
    return standard_response(True, "KYC detail retrieved", {
        "id": str(v.id),
        "service_id": str(v.user_service_id) if v.user_service_id else None,
        "service_name": service.title if service else None,
        "status": v.verification_status.value if v.verification_status else None,
        "notes": v.remarks,
        "submitted_at": v.created_at.isoformat() if v.created_at else None,
        "files": doc_files,
        "kyc_items": kyc_items,
        "user": {
            "id": str(user.id) if user else None,
            "name": f"{user.first_name} {user.last_name}".strip() if user else None,
            "email": user.email if user else None,
            "avatar": profile.profile_picture_url if profile else None,
        } if user else None,
    })


@router.put("/kyc/item/{kyc_status_id}/approve")
def approve_kyc_item(
    kyc_status_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Approve a single KYC item. Service only marked verified when ALL items are approved."""
    try:
        kid = uuid.UUID(kyc_status_id)
    except ValueError:
        return standard_response(False, "Invalid KYC status ID")
    ks = db.query(UserServiceKYCStatus).filter(UserServiceKYCStatus.id == kid).first()
    if not ks:
        return standard_response(False, "KYC status item not found")
    ks.status = VerificationStatusEnum.verified
    ks.remarks = body.get("notes", ks.remarks)
    ks.reviewed_at = datetime.now(EAT)
    ks.updated_at = datetime.now(EAT)
    db.flush()
    # Check if all KYC items for this verification are now approved
    verification = db.query(UserServiceVerification).filter(
        UserServiceVerification.id == ks.verification_id
    ).first()
    service_owner_id = None
    service_title = None
    all_approved = False
    if verification:
        all_items = db.query(UserServiceKYCStatus).filter(
            UserServiceKYCStatus.verification_id == ks.verification_id
        ).all()
        all_approved = all(
            item.status == VerificationStatusEnum.verified for item in all_items
        )
        if all_approved:
            verification.verification_status = VerificationStatusEnum.verified
            verification.verified_at = datetime.now(EAT)
            verification.updated_at = datetime.now(EAT)
            # Only mark the service as verified if user has identity verified
            if verification.user_service_id:
                service = db.query(UserService).filter(
                    UserService.id == verification.user_service_id
                ).first()
                if service:
                    service_owner_id = service.user_id
                    service_title = service.title
                    owner = db.query(User).filter(User.id == service.user_id).first()
                    if owner and owner.is_identity_verified:
                        service.verification_status = VerificationStatusEnum.verified
                        service.is_verified = True
                    # else: KYC all approved but identity not verified — service stays pending
        else:
            # Mark verification as still in progress (pending)
            if verification.verification_status != VerificationStatusEnum.pending:
                verification.verification_status = VerificationStatusEnum.pending
            # Still grab service info for partial approval notification
            if verification.user_service_id:
                service = db.query(UserService).filter(
                    UserService.id == verification.user_service_id
                ).first()
                if service:
                    service_owner_id = service.user_id
                    service_title = service.title
    db.commit()
    # Send notification to service owner
    if service_owner_id:
        if all_approved:
            owner = db.query(User).filter(User.id == service_owner_id).first()
            if owner and owner.is_identity_verified:
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_id=service_owner_id,
                    sender_ids=[],
                    type=NotificationTypeEnum.service_approved,
                    reference_id=verification.user_service_id if verification else None,
                    reference_type="user_service",
                    message_template=f"🎉 Your service \"{service_title}\" has been fully verified and is now live!",
                    message_data={"service_title": service_title},
                    is_read=False,
                )
            else:
                # KYC all approved but identity not verified
                notif = Notification(
                    id=uuid.uuid4(),
                    recipient_id=service_owner_id,
                    sender_ids=[],
                    type=NotificationTypeEnum.service_approved,
                    reference_id=verification.user_service_id if verification else None,
                    reference_type="user_service",
                    message_template=f"✅ All business documents for \"{service_title}\" have been approved! Complete your identity verification to activate your service.",
                    message_data={"service_title": service_title, "needs_identity": True},
                    is_read=False,
                )
        else:
            # KYC item approved (partial) — still notify
            req = ks.kyc_requirement
            item_name = req.name if req else "KYC document"
            notif = Notification(
                id=uuid.uuid4(),
                recipient_id=service_owner_id,
                sender_ids=[],
                type=NotificationTypeEnum.service_approved,
                reference_id=verification.user_service_id if verification else None,
                reference_type="user_service",
                message_template=f"Your KYC document \"{item_name}\" for \"{service_title}\" has been approved.",
                message_data={"service_title": service_title, "item_name": item_name},
                is_read=False,
            )
        db.add(notif)
        db.commit()
    all_items_count = len(db.query(UserServiceKYCStatus).filter(
        UserServiceKYCStatus.verification_id == ks.verification_id
    ).all()) if verification else 0
    approved_count = len(db.query(UserServiceKYCStatus).filter(
        UserServiceKYCStatus.verification_id == ks.verification_id,
        UserServiceKYCStatus.status == VerificationStatusEnum.verified,
    ).all()) if verification else 0
    return standard_response(True, "KYC item approved", {
        "all_approved": approved_count == all_items_count,
        "approved_count": approved_count,
        "total_count": all_items_count,
    })


@router.put("/kyc/item/{kyc_status_id}/reject")
def reject_kyc_item(
    kyc_status_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Reject a single KYC item."""
    try:
        kid = uuid.UUID(kyc_status_id)
    except ValueError:
        return standard_response(False, "Invalid KYC status ID")
    ks = db.query(UserServiceKYCStatus).filter(UserServiceKYCStatus.id == kid).first()
    if not ks:
        return standard_response(False, "KYC status item not found")
    notes = body.get("notes", "").strip()
    if not notes:
        return standard_response(False, "Rejection reason is required")
    ks.status = VerificationStatusEnum.rejected
    ks.remarks = notes
    ks.reviewed_at = datetime.now(EAT)
    ks.updated_at = datetime.now(EAT)
    db.flush()
    # When any item is rejected, mark overall verification as rejected
    verification = db.query(UserServiceVerification).filter(
        UserServiceVerification.id == ks.verification_id
    ).first()
    service_owner_id = None
    service_title = None
    if verification:
        verification.verification_status = VerificationStatusEnum.rejected
        verification.updated_at = datetime.now(EAT)
        if verification.user_service_id:
            service = db.query(UserService).filter(
                UserService.id == verification.user_service_id
            ).first()
            if service:
                service.verification_status = VerificationStatusEnum.rejected
                service_owner_id = service.user_id
                service_title = service.title
    db.commit()
    # Send rejection notification to service owner
    if service_owner_id:
        req = ks.kyc_requirement
        item_name = req.name if req else "KYC document"
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=service_owner_id,
            sender_ids=[],
            type=NotificationTypeEnum.service_rejected,
            reference_id=verification.user_service_id if verification else None,
            reference_type="user_service",
            message_template=f"Your KYC document \"{item_name}\" for \"{service_title}\" was rejected. Reason: {notes}",
            message_data={"service_title": service_title, "item_name": item_name, "reason": notes},
            is_read=False,
        )
        db.add(notif)
        db.commit()
    return standard_response(True, "KYC item rejected")


# ──────────────────────────────────────────────
# EVENT TYPES MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/event-types")
def list_event_types(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    types = db.query(EventType).order_by(EventType.name.asc()).all()
    data = [{"id": str(t.id), "name": t.name, "description": t.description if hasattr(t, 'description') else None, "icon": t.icon if hasattr(t, 'icon') else None, "is_active": t.is_active if hasattr(t, 'is_active') else True} for t in types]
    return standard_response(True, "Event types retrieved", data)


@router.post("/event-types")
def create_event_type(body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    name = body.get("name", "").strip()
    if not name:
        return standard_response(False, "Name is required")
    now = datetime.now(EAT)
    et = EventType(id=uuid.uuid4(), name=name)
    if hasattr(et, 'description'):
        et.description = body.get("description")
    if hasattr(et, 'icon'):
        et.icon = body.get("icon")
    if hasattr(et, 'created_at'):
        et.created_at = now
    db.add(et)
    db.commit()
    return standard_response(True, "Event type created", {"id": str(et.id), "name": et.name})


@router.put("/event-types/{type_id}")
def update_event_type(type_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(type_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    et = db.query(EventType).filter(EventType.id == tid).first()
    if not et:
        return standard_response(False, "Event type not found")
    if body.get("name"):
        et.name = body["name"].strip()
    if "description" in body and hasattr(et, 'description'):
        et.description = body["description"]
    if "icon" in body and hasattr(et, 'icon'):
        et.icon = body["icon"]
    if "is_active" in body and hasattr(et, 'is_active'):
        et.is_active = body["is_active"]
    db.commit()
    return standard_response(True, "Event type updated")


@router.delete("/event-types/{type_id}")
def delete_event_type(type_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(type_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    et = db.query(EventType).filter(EventType.id == tid).first()
    if not et:
        return standard_response(False, "Event type not found")
    db.delete(et)
    db.commit()
    return standard_response(True, "Event type deleted")


# ──────────────────────────────────────────────
# LIVE CHAT ADMIN
# ──────────────────────────────────────────────

@router.get("/chats")
def list_chat_sessions(
    page: int = 1, limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(LiveChatSession).options(
        joinedload(LiveChatSession.user).joinedload(User.profile),
    )
    if status:
        try:
            status_enum = ChatSessionStatusEnum(status)
            query = query.filter(LiveChatSession.status == status_enum)
        except ValueError:
            pass
    query = query.order_by(LiveChatSession.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for s in items:
        user = s.user
        profile = user.profile if user else None
        # Count unread messages (from user, not agent)
        last_agent_msg = db.query(LiveChatMessage).filter(
            LiveChatMessage.session_id == s.id,
            LiveChatMessage.is_agent == True
        ).order_by(LiveChatMessage.created_at.desc()).first()
        
        last_user_msg = db.query(LiveChatMessage).filter(
            LiveChatMessage.session_id == s.id,
            LiveChatMessage.is_agent == False,
            LiveChatMessage.is_system == False,
        ).order_by(LiveChatMessage.created_at.desc()).first()

        data.append({
            "id": str(s.id),
            "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_message": last_user_msg.message_text if last_user_msg else None,
            "last_message_at": last_user_msg.created_at.isoformat() if last_user_msg and last_user_msg.created_at else None,
            "user": {
                "id": str(user.id) if user else None,
                "name": f"{user.first_name} {user.last_name}" if user else None,
                "email": user.email if user else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if user else None,
        })
    return standard_response(True, "Chat sessions retrieved", data, pagination=pagination)


@router.get("/chats/{chat_id}/messages")
def get_chat_messages_admin(
    chat_id: str,
    after: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    session = db.query(LiveChatSession).options(
        joinedload(LiveChatSession.user).joinedload(User.profile)
    ).filter(LiveChatSession.id == cid).first()
    if not session:
        return standard_response(False, "Chat session not found")
    query = db.query(LiveChatMessage).filter(LiveChatMessage.session_id == cid)
    if after:
        try:
            after_dt = datetime.fromisoformat(after)
            query = query.filter(LiveChatMessage.created_at > after_dt)
        except ValueError:
            pass
    messages = query.order_by(LiveChatMessage.created_at.asc()).all()
    # Build user info for sender display
    session_user = session.user
    session_profile = session_user.profile if session_user else None
    user_name = f"{session_user.first_name} {session_user.last_name}" if session_user else "User"
    user_avatar = session_profile.profile_picture_url if session_profile else None
    data = []
    for m in messages:
        data.append({
            "id": str(m.id),
            "content": m.message_text,
            "sender": "agent" if m.is_agent else ("system" if m.is_system else "user"),
            "sender_name": "Support Team" if m.is_agent else ("System" if m.is_system else user_name),
            "sent_at": m.created_at.isoformat() if m.created_at else None,
        })
    return standard_response(True, "Messages retrieved", {
        "messages": data,
        "session_status": session.status.value if hasattr(session.status, 'value') else str(session.status),
        "user": {
            "name": user_name,
            "avatar": user_avatar,
        } if session_user else None,
    })


@router.post("/chats/{chat_id}/reply")
def reply_to_chat(
    chat_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    session = db.query(LiveChatSession).filter(LiveChatSession.id == cid).first()
    if not session:
        return standard_response(False, "Chat session not found")
    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Message content is required")
    now = datetime.now(EAT)
    
    # Mark session as active when agent first replies (don't set agent_id since admin_users != users)
    if session.status != ChatSessionStatusEnum.active:
        session.status = ChatSessionStatusEnum.active

    # sender_id references users table — admin_users are NOT in users table.
    # Leave sender_id as NULL for agent messages; is_agent=True identifies the sender.
    msg = LiveChatMessage(
        id=uuid.uuid4(),
        session_id=cid,
        sender_id=None,
        is_agent=True,
        is_system=False,
        message_text=content,
        created_at=now,
    )
    db.add(msg)
    db.commit()
    return standard_response(True, "Reply sent", {
        "id": str(msg.id),
        "content": msg.message_text,
        "sender": "agent",
        "sender_name": admin.full_name,
        "sent_at": msg.created_at.isoformat() if msg.created_at else None,
    })


@router.put("/chats/{chat_id}/close")
def close_chat_admin(chat_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    session = db.query(LiveChatSession).filter(LiveChatSession.id == cid).first()
    if session:
        session.status = ChatSessionStatusEnum.ended
        session.ended_at = datetime.now(EAT)
        db.commit()
    return standard_response(True, "Chat closed")


# ──────────────────────────────────────────────
# SUPPORT TICKETS ADMIN
# ──────────────────────────────────────────────

@router.get("/tickets")
def list_all_tickets(
    page: int = 1, limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(SupportTicket).options(joinedload(SupportTicket.user).joinedload(User.profile))
    if status:
        query = query.filter(SupportTicket.status == status)
    query = query.order_by(SupportTicket.updated_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for t in items:
        user = t.user
        profile = user.profile if user else None
        data.append({
            "id": str(t.id),
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority.value if hasattr(t.priority, 'value') else str(t.priority) if t.priority else "medium",
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "user": {
                "id": str(user.id) if user else None,
                "name": f"{user.first_name} {user.last_name}" if user else None,
                "email": user.email if user else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if user else None,
        })
    return standard_response(True, "Tickets retrieved", data, pagination=pagination)


@router.get("/tickets/{ticket_id}")
def get_ticket_admin(ticket_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")
    ticket = db.query(SupportTicket).options(
        joinedload(SupportTicket.user).joinedload(User.profile),
        joinedload(SupportTicket.messages),
    ).filter(SupportTicket.id == tid).first()
    if not ticket:
        return standard_response(False, "Ticket not found")
    user = ticket.user
    profile = user.profile if user else None
    messages = sorted(ticket.messages or [], key=lambda m: m.created_at or datetime.min)
    msgs = [{
        "id": str(m.id),
        "content": m.message_text,
        "is_agent": m.is_agent,
        "sender_name": "Support Team" if m.is_agent else (f"{user.first_name} {user.last_name}" if user else "User"),
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in messages]
    return standard_response(True, "Ticket retrieved", {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority.value if hasattr(ticket.priority, 'value') else str(ticket.priority) if ticket.priority else "medium",
        "messages": msgs,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "user": {
            "id": str(user.id) if user else None,
            "name": f"{user.first_name} {user.last_name}" if user else None,
            "email": user.email if user else None,
            "avatar": profile.profile_picture_url if profile else None,
        } if user else None,
    })


@router.post("/tickets/{ticket_id}/reply")
def reply_ticket_admin(
    ticket_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid).first()
    if not ticket:
        return standard_response(False, "Ticket not found")
    content = body.get("message", "").strip()
    if not content:
        return standard_response(False, "Message is required")
    now = datetime.now(EAT)
    msg = SupportMessage(
        id=uuid.uuid4(),
        ticket_id=tid,
        sender_id=None,  # admin_users are not in users table; is_agent=True identifies sender
        is_agent=True,
        message_text=content,
        created_at=now,
    )
    db.add(msg)
    ticket.status = "open"
    ticket.updated_at = now
    db.commit()
    return standard_response(True, "Reply sent")


@router.put("/tickets/{ticket_id}/close")
def close_ticket_admin(ticket_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid).first()
    if not ticket:
        return standard_response(False, "Ticket not found")
    ticket.status = "closed"
    ticket.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Ticket closed")


# ──────────────────────────────────────────────
# FAQ MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/faqs")
def list_faqs(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    faqs = db.query(FAQ).order_by(FAQ.display_order.asc(), FAQ.created_at.desc()).all()
    data = [{"id": str(f.id), "question": f.question, "answer": f.answer, "category": f.category, "display_order": f.display_order, "is_active": f.is_active} for f in faqs]
    return standard_response(True, "FAQs retrieved", data)


@router.post("/faqs")
def create_faq(body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    if not body.get("question") or not body.get("answer"):
        return standard_response(False, "Question and answer are required")
    faq = FAQ(
        id=uuid.uuid4(),
        question=body["question"].strip(),
        answer=body["answer"].strip(),
        category=body.get("category", "General"),
        display_order=body.get("display_order", 0),
        is_active=body.get("is_active", True),
    )
    db.add(faq)
    db.commit()
    return standard_response(True, "FAQ created", {"id": str(faq.id)})


@router.put("/faqs/{faq_id}")
def update_faq(faq_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        fid = uuid.UUID(faq_id)
    except ValueError:
        return standard_response(False, "Invalid FAQ ID")
    faq = db.query(FAQ).filter(FAQ.id == fid).first()
    if not faq:
        return standard_response(False, "FAQ not found")
    for field in ["question", "answer", "category", "display_order", "is_active"]:
        if field in body:
            setattr(faq, field, body[field])
    db.commit()
    return standard_response(True, "FAQ updated")


@router.delete("/faqs/{faq_id}")
def delete_faq(faq_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        fid = uuid.UUID(faq_id)
    except ValueError:
        return standard_response(False, "Invalid FAQ ID")
    faq = db.query(FAQ).filter(FAQ.id == fid).first()
    if not faq:
        return standard_response(False, "FAQ not found")
    db.delete(faq)
    db.commit()
    return standard_response(True, "FAQ deleted")


# ──────────────────────────────────────────────
# EVENTS ADMIN
# ──────────────────────────────────────────────

@router.get("/events")
def list_events_admin(
    page: int = 1, limit: int = 20,
    q: str = None,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(Event).options(joinedload(Event.organizer).joinedload(User.profile))
    if q:
        query = query.filter(Event.name.ilike(f"%{q}%"))
    if status:
        try:
            query = query.filter(Event.status == EventStatusEnum(status))
        except ValueError:
            pass
    query = query.order_by(Event.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for e in items:
        org = e.organizer
        # Resolve cover image — Event model has cover_image_url directly
        image = (
            getattr(e, 'cover_image_url', None) or
            getattr(e, 'featured_image', None) or
            getattr(e, 'primary_image', None) or
            getattr(e, 'image', None) or
            getattr(e, 'image_url', None)
        )
        if not image:
            imgs = getattr(e, 'images', None) or getattr(e, 'gallery', None) or []
            if imgs:
                first = imgs[0]
                if isinstance(first, str):
                    image = first
                elif isinstance(first, dict):
                    image = first.get('url') or first.get('image_url') or first.get('file_url')
                else:
                    image = getattr(first, 'image_url', None) or getattr(first, 'url', None) or getattr(first, 'file_url', None)
        data.append({
            "id": str(e.id),
            "name": e.name,
            "status": e.status.value if hasattr(e.status, 'value') else str(e.status),
            "date": e.start_date.isoformat() if e.start_date else None,
            "location": e.location,
            "image": image,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "organizer": {
                "id": str(org.id) if org else None,
                "name": f"{org.first_name} {org.last_name}" if org else None,
            } if org else None,
        })
    return standard_response(True, "Events retrieved", data, pagination=pagination)


@router.get("/events/{event_id}")
def get_event_detail_admin(
    event_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Get full event detail for admin review."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")
    e = db.query(Event).options(
        joinedload(Event.organizer).joinedload(User.profile),
        joinedload(Event.event_type),
    ).filter(Event.id == eid).first()
    if not e:
        return standard_response(False, "Event not found")
    org = e.organizer
    org_profile = org.profile if org else None

    # Cover image
    image = (
        getattr(e, 'cover_image_url', None) or
        getattr(e, 'featured_image', None) or
        getattr(e, 'primary_image', None) or
        getattr(e, 'image', None) or
        getattr(e, 'image_url', None)
    )
    if not image:
        imgs = getattr(e, 'images', None) or []
        if imgs:
            first = imgs[0]
            if isinstance(first, str):
                image = first
            elif isinstance(first, dict):
                image = first.get('url') or first.get('image_url')
            else:
                image = getattr(first, 'image_url', None) or getattr(first, 'url', None)

    # Guest count
    guest_count = db.query(func.count(EventInvitation.id)).filter(
        EventInvitation.event_id == eid
    ).scalar() or 0

    # Committee members
    committee_count = db.query(func.count(EventCommitteeMember.id)).filter(
        EventCommitteeMember.event_id == eid
    ).scalar() or 0

    return standard_response(True, "Event detail retrieved", {
        "id": str(e.id),
        "name": e.name,
        "description": e.description if hasattr(e, 'description') else None,
        "status": e.status.value if hasattr(e.status, 'value') else str(e.status),
        "start_date": e.start_date.isoformat() if e.start_date else None,
        "end_date": e.end_date.isoformat() if getattr(e, 'end_date', None) else None,
        "location": e.location,
        "venue": getattr(e, 'venue', None),
        "image": image,
        "event_type": e.event_type.name if e.event_type else None,
        "is_public": getattr(e, 'is_public', True),
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "guest_count": guest_count,
        "committee_count": committee_count,
        "organizer": {
            "id": str(org.id) if org else None,
            "name": f"{org.first_name} {org.last_name}".strip() if org else None,
            "email": org.email if org else None,
            "avatar": org_profile.profile_picture_url if org_profile else None,
        } if org else None,
    })


@router.put("/events/{event_id}/status")
def update_event_status_admin(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Admin can update any event's status."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")
    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    new_status = body.get("status", "").strip()
    if not new_status:
        return standard_response(False, "Status is required")
    try:
        event.status = EventStatusEnum(new_status)
    except ValueError:
        return standard_response(False, f"Invalid status: {new_status}")
    event.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Event status updated", {"status": event.status.value})


# ──────────────────────────────────────────────
# SERVICES ADMIN
# ──────────────────────────────────────────────

@router.get("/services")
def list_services_admin(
    page: int = 1, limit: int = 20,
    q: str = None,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(UserService).options(
        joinedload(UserService.user).joinedload(User.profile),
        joinedload(UserService.category),
    )
    if q:
        query = query.filter(UserService.title.ilike(f"%{q}%"))
    if status:
        try:
            status_enum = VerificationStatusEnum(status)
            query = query.filter(UserService.verification_status == status_enum)
        except ValueError:
            pass
    query = query.order_by(UserService.created_at.desc(), UserService.id.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for s in items:
        user = s.user
        profile = user.profile if user else None
        data.append({
            "id": str(s.id),
            "name": s.title,
            "category": s.category.name if s.category else None,
            "verification_status": s.verification_status.value if s.verification_status else "pending",
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "user": {
                "id": str(user.id) if user else None,
                "name": f"{user.first_name} {user.last_name}".strip() if user else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if user else None,
        })
    return standard_response(True, "Services retrieved", data, pagination=pagination)


@router.get("/services/{service_id}")
def get_service_detail_admin(
    service_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")
    s = db.query(UserService).options(
        joinedload(UserService.user).joinedload(User.profile),
        joinedload(UserService.category),
        joinedload(UserService.service_type),
        joinedload(UserService.images),
        joinedload(UserService.packages),
        joinedload(UserService.ratings),
        joinedload(UserService.verifications).joinedload(UserServiceVerification.kyc_statuses).joinedload(UserServiceKYCStatus.kyc_requirement),
    ).filter(UserService.id == sid).first()
    if not s:
        return standard_response(False, "Service not found")
    user = s.user
    profile = user.profile if user else None
    packages = [
        {
            "id": str(p.id),
            "name": p.name,
            "price": float(p.price) if p.price else None,
            "description": p.description,
            "features": p.features,
        } for p in (s.packages or [])
    ]
    images = [{"id": str(i.id), "url": i.image_url, "is_featured": i.is_featured} for i in (s.images or [])]
    avg_rating = None
    if s.ratings:
        avg_rating = round(sum(r.rating for r in s.ratings) / len(s.ratings), 1)
    # Latest verification
    verif = None
    if s.verifications:
        latest = sorted(s.verifications, key=lambda v: v.created_at or datetime.min, reverse=True)[0]
        kyc_items = []
        for ks in (latest.kyc_statuses or []):
            req = ks.kyc_requirement
            kyc_items.append({
                "id": str(ks.id),
                "name": req.name if req else None,
                "status": ks.status.value if ks.status else "pending",
                "remarks": ks.remarks,
            })
        verif = {
            "id": str(latest.id),
            "status": latest.verification_status.value if latest.verification_status else None,
            "submitted_at": latest.created_at.isoformat() if latest.created_at else None,
            "kyc_items": kyc_items,
        }
    return standard_response(True, "Service detail retrieved", {
        "id": str(s.id),
        "title": s.title,
        "description": s.description,
        "category": s.category.name if s.category else None,
        "service_type": s.service_type.name if s.service_type else None,
        "min_price": float(s.min_price) if s.min_price else None,
        "max_price": float(s.max_price) if s.max_price else None,
        "availability": s.availability.value if s.availability else None,
        "verification_status": s.verification_status.value if s.verification_status else "pending",
        "is_verified": s.is_verified,
        "is_active": s.is_active,
        "location": s.location,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "average_rating": avg_rating,
        "total_ratings": len(s.ratings) if s.ratings else 0,
        "packages": packages,
        "images": images,
        "verification": verif,
        "user": {
            "id": str(user.id) if user else None,
            "name": f"{user.first_name} {user.last_name}".strip() if user else None,
            "email": user.email if user else None,
            "phone": user.phone if user else None,
            "avatar": profile.profile_picture_url if profile else None,
        } if user else None,
    })



@router.put("/services/{service_id}/toggle-active")
def toggle_service_active_admin(
    service_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Admin can suspend or activate a service."""
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")
    s = db.query(UserService).filter(UserService.id == sid).first()
    if not s:
        return standard_response(False, "Service not found")
    s.is_active = body.get("is_active", not s.is_active)
    db.commit()
    return standard_response(True, f"Service {'activated' if s.is_active else 'suspended'}")


@router.put("/services/{service_id}/verification-status")
def update_service_verification_status_admin(
    service_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Admin can manually set a service's verification status."""
    try:
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid service ID")
    s = db.query(UserService).filter(UserService.id == sid).first()
    if not s:
        return standard_response(False, "Service not found")
    new_status = body.get("status", "")
    try:
        s.verification_status = VerificationStatusEnum(new_status)
        if new_status == "verified":
            s.is_verified = True
        elif new_status in ("rejected", "pending", "suspended"):
            s.is_verified = False
    except ValueError:
        return standard_response(False, f"Invalid status: {new_status}")
    db.commit()
    # Notify provider
    if s.user_id:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=s.user_id,
            type=NotificationTypeEnum.system,
            message_template=f"Your service \"{s.title}\" status has been updated to: {new_status}.",
            message_data={"service_title": s.title, "status": new_status},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    return standard_response(True, "Service verification status updated")



# ──────────────────────────────────────────────
# POST / MOMENT DETAIL + ECHO DELETION
# ──────────────────────────────────────────────

@router.get("/posts/{post_id}")
def get_post_detail_admin(post_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).options(
        joinedload(UserFeed.user).joinedload(User.profile),
        joinedload(UserFeed.images),
    ).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    u = post.user
    profile = u.profile if u else None

    # Live counts — never read stale denormalized columns
    live_glows = db.query(func.count(UserFeedGlow.id)).filter(UserFeedGlow.feed_id == pid).scalar() or 0
    live_echo_count = db.query(func.count(UserFeedComment.id)).filter(
        UserFeedComment.feed_id == pid,
        UserFeedComment.is_active == True,
    ).scalar() or 0

    # Load ALL active echoes (all levels) then build tree client-side
    all_echoes = db.query(UserFeedComment).options(
        joinedload(UserFeedComment.user).joinedload(User.profile)
    ).filter(
        UserFeedComment.feed_id == pid,
        UserFeedComment.is_active == True,
    ).order_by(UserFeedComment.created_at.asc()).all()

    def build_echo(e):
        eu = e.user
        eprofile = eu.profile if eu else None
        return {
            "id": str(e.id),
            "content": e.content,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "parent_comment_id": str(e.parent_comment_id) if e.parent_comment_id else None,
            "user": {
                "id": str(eu.id) if eu else None,
                "name": f"{eu.first_name} {eu.last_name}" if eu else None,
                "username": eu.username if eu else None,
                "avatar": eprofile.profile_picture_url if eprofile else None,
            } if eu else None,
            "replies": [],
        }

    # Build nested tree
    echo_map = {str(e.id): build_echo(e) for e in all_echoes}
    roots = []
    for e in all_echoes:
        node = echo_map[str(e.id)]
        if e.parent_comment_id and str(e.parent_comment_id) in echo_map:
            echo_map[str(e.parent_comment_id)]["replies"].append(node)
        else:
            roots.append(node)

    return standard_response(True, "Post detail retrieved", {
        "id": str(post.id),
        "content": post.content,
        "location": post.location,
        "is_active": post.is_active,
        "removal_reason": post.removal_reason if hasattr(post, "removal_reason") else None,
        "glow_count": live_glows,
        "echo_count": live_echo_count,
        "comment_count": live_echo_count,
        "view_count": getattr(post, 'view_count', 0) or 0,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "images": [{"url": img.image_url} for img in (post.images or [])],
        "echoes": roots,
        "user": {
            "id": str(u.id) if u else None,
            "name": f"{u.first_name} {u.last_name}" if u else None,
            "username": u.username if u else None,
            "avatar": profile.profile_picture_url if profile else None,
        } if u else None,
    })


@router.delete("/posts/{post_id}/echoes/{echo_id}")
def delete_post_echo_admin(post_id: str, echo_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        eid = uuid.UUID(echo_id)
    except ValueError:
        return standard_response(False, "Invalid echo ID")
    echo = db.query(UserFeedComment).filter(UserFeedComment.id == eid).first()
    if not echo:
        return standard_response(False, "Echo not found")
    echo.is_active = False
    db.commit()
    return standard_response(True, "Echo deleted")


@router.get("/moments/{moment_id}")
def get_moment_detail_admin(moment_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID")
    moment = db.query(UserMoment).options(
        joinedload(UserMoment.user).joinedload(User.profile),
    ).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")
    u = moment.user
    profile = u.profile if u else None
    # Moments use UserMomentViewer for view tracking — no standalone echo/reply model
    return standard_response(True, "Moment detail retrieved", {
        "id": str(moment.id),
        "caption": moment.caption,
        "content_type": moment.content_type.value if hasattr(moment.content_type, 'value') else str(moment.content_type),
        "media_url": moment.media_url,
        "is_active": moment.is_active,
        "view_count": moment.view_count,
        "privacy": moment.privacy.value if hasattr(moment.privacy, 'value') else str(moment.privacy),
        "created_at": moment.created_at.isoformat() if moment.created_at else None,
        "echoes": [],
        "user": {
            "id": str(u.id) if u else None,
            "name": f"{u.first_name} {u.last_name}" if u else None,
            "username": u.username if u else None,
            "avatar": profile.profile_picture_url if profile else None,
        } if u else None,
    })


@router.put("/moments/{moment_id}/status")
def update_moment_status_admin(
    moment_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID")
    moment = db.query(UserMoment).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")
    is_active = body.get("is_active", moment.is_active)
    reason = (body.get("reason") or "").strip() or None
    moment.is_active = is_active
    # Persist removal reason; clear on restore
    if hasattr(moment, 'removal_reason'):
        moment.removal_reason = None if is_active else reason
    db.commit()
    # Notify user
    if moment.user_id:
        status_word = "restored" if is_active else "removed"
        reason_suffix = f" Reason: {reason}" if reason and not is_active else ""
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=moment.user_id,
            type=NotificationTypeEnum.system,
            message_template=f"Your moment has been {status_word} by an administrator.{reason_suffix}",
            message_data={"moment_id": str(moment.id), "status": status_word, "reason": reason},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    return standard_response(True, f"Moment {'restored' if is_active else 'removed'}")


@router.delete("/moments/{moment_id}/echoes/{echo_id}")
def delete_moment_echo_admin(moment_id: str, echo_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    # Moments don't have a standalone Echo model
    return standard_response(True, "Echo deleted")


# ──────────────────────────────────────────────
# USER IDENTITY VERIFICATION ADMIN
# ──────────────────────────────────────────────

def _group_identity_submissions(items):
    """Group individual document rows into submissions by user + created_at."""
    groups = {}
    for v in items:
        # Documents submitted together share exact same created_at
        key = (str(v.user_id), str(v.created_at))
        if key not in groups:
            groups[key] = []
        groups[key].append(v)
    return groups


@router.get("/user-verifications")
def list_user_verifications_admin(
    page: int = 1, limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    # Get all verifications (we group them, so fetch by distinct user submissions)
    query = db.query(UserIdentityVerification).options(
        joinedload(UserIdentityVerification.user).joinedload(User.profile),
        joinedload(UserIdentityVerification.document_type),
    )
    if status:
        try:
            status_enum = VerificationStatusEnum(status)
            query = query.filter(UserIdentityVerification.verification_status == status_enum)
        except ValueError:
            pass
    query = query.order_by(UserIdentityVerification.created_at.desc())
    all_items = query.all()

    # Group into submissions
    groups = _group_identity_submissions(all_items)
    submissions = []
    for (uid, ts), docs in groups.items():
        first = docs[0]
        u = first.user
        profile = u.profile if u else None

        # Determine overall status: all verified = verified, any rejected = rejected, else pending
        statuses = [d.verification_status.value if d.verification_status else "pending" for d in docs]
        if "rejected" in statuses:
            overall_status = "rejected"
        elif all(s == "verified" for s in statuses):
            overall_status = "verified"
        else:
            overall_status = "pending"

        # Get the real document number (from the front doc, not the back/selfie variants)
        doc_number = None
        for d in docs:
            if d.document_number and d.document_number != "N/A" and "(back)" not in d.document_number and "(selfie)" not in d.document_number:
                doc_number = d.document_number
                break
        if not doc_number:
            # Fallback: strip suffixes
            for d in docs:
                if d.document_number and d.document_number != "N/A":
                    doc_number = d.document_number.replace(" (back)", "").replace(" (selfie)", "")
                    break

        doc_type = first.document_type
        documents = []
        for d in docs:
            label = "ID Front"
            if d.remarks == "ID Back":
                label = "ID Back"
            elif d.remarks == "Selfie":
                label = "Selfie"
            documents.append({
                "id": str(d.id),
                "label": label,
                "file_url": d.document_file_url,
                "status": d.verification_status.value if d.verification_status else "pending",
                "remarks": d.remarks if d.remarks not in ("ID Back", "Selfie", None) else None,
            })

        submissions.append({
            "id": str(first.id),  # Use first doc's ID as submission reference
            "submission_ids": [str(d.id) for d in docs],
            "document_type": doc_type.name if doc_type else "—",
            "document_number": doc_number or "—",
            "verification_status": overall_status,
            "documents": documents,
            "created_at": first.created_at.isoformat() if first.created_at else None,
            "user": {
                "id": str(u.id) if u else None,
                "name": f"{u.first_name} {u.last_name}".strip() if u else None,
                "email": u.email if u else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if u else None,
        })

    # If status filter was applied, filter already happened at query level
    # Manual pagination over grouped results
    total = len(submissions)
    total_pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    end = start + limit
    page_data = submissions[start:end]

    pagination = {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }
    return standard_response(True, "User verifications retrieved", page_data, pagination=pagination)


@router.put("/user-verifications/{verification_id}/approve")
def approve_user_verification(
    verification_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        vid = uuid.UUID(verification_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    v = db.query(UserIdentityVerification).filter(UserIdentityVerification.id == vid).first()
    if not v:
        return standard_response(False, "Verification not found")
    v.verification_status = VerificationStatusEnum.verified
    v.verified_at = datetime.now(EAT)
    v.remarks = body.get("notes", v.remarks)
    v.updated_at = datetime.now(EAT)
    db.commit()

    # Check batch status
    batch = db.query(UserIdentityVerification).filter(
        UserIdentityVerification.user_id == v.user_id,
        UserIdentityVerification.created_at == v.created_at,
    ).all()
    approved_count = sum(1 for d in batch if d.verification_status == VerificationStatusEnum.verified)
    total_count = len(batch)

    # Identity is verified if the FRONT document is approved (front = no "back"/"selfie" suffix)
    front_doc = next(
        (d for d in batch if d.remarks not in ("ID Back", "Selfie")),
        None
    )
    front_approved = front_doc and front_doc.verification_status == VerificationStatusEnum.verified
    all_verified = all(d.verification_status == VerificationStatusEnum.verified for d in batch)

    if front_approved:
        user = db.query(User).filter(User.id == v.user_id).first()
        if user and not user.is_identity_verified:
            user.is_identity_verified = True
            db.commit()

            # Auto-activate services where ALL KYC items are approved but service is still pending
            user_services = db.query(UserService).filter(
                UserService.user_id == user.id,
                UserService.is_active == True,
                UserService.is_verified == False,
            ).all()
            activated_titles = []
            for svc in user_services:
                # Check if this service has a verification with all KYC approved
                ver = db.query(UserServiceVerification).filter(
                    UserServiceVerification.user_service_id == svc.id,
                    UserServiceVerification.verification_status == VerificationStatusEnum.verified,
                ).first()
                if ver:
                    svc.verification_status = VerificationStatusEnum.verified
                    svc.is_verified = True
                    activated_titles.append(svc.title)
            if activated_titles:
                db.commit()
                # Notify user about auto-activated services
                titles_str = ", ".join(f'"{t}"' for t in activated_titles)
                svc_notif = Notification(
                    id=uuid.uuid4(),
                    recipient_id=user.id,
                    type=NotificationTypeEnum.service_approved,
                    message_template=f"🎉 Your identity is verified! Your services {titles_str} are now live and accepting bookings.",
                    message_data={"activated_services": activated_titles},
                    is_read=False,
                    created_at=datetime.now(EAT),
                )
                db.add(svc_notif)
                db.commit()

            notif = Notification(
                id=uuid.uuid4(),
                recipient_id=v.user_id,
                type=NotificationTypeEnum.system,
                message_template="Your identity has been verified! Your account is now fully verified.",
                message_data={"status": "verified"},
                is_read=False,
                created_at=datetime.now(EAT),
            )
            db.add(notif)
            db.commit()

    return standard_response(True, "Document approved", {
        "approved_count": approved_count,
        "total_count": total_count,
        "all_approved": all_verified,
        "identity_verified": bool(front_approved),
    })


@router.put("/user-verifications/{verification_id}/reject")
def reject_user_verification(
    verification_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        vid = uuid.UUID(verification_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    v = db.query(UserIdentityVerification).filter(UserIdentityVerification.id == vid).first()
    if not v:
        return standard_response(False, "Verification not found")
    notes = body.get("notes", "").strip()
    if not notes:
        return standard_response(False, "Rejection reason is required")

    # Reject ALL documents in this submission batch
    batch = db.query(UserIdentityVerification).filter(
        UserIdentityVerification.user_id == v.user_id,
        UserIdentityVerification.created_at == v.created_at,
    ).all()
    for d in batch:
        d.verification_status = VerificationStatusEnum.rejected
        d.remarks = notes
        d.updated_at = datetime.now(EAT)
    db.commit()

    if v.user_id:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=v.user_id,
            type=NotificationTypeEnum.system,
            message_template=f"Your identity verification was rejected. Reason: {notes}",
            message_data={"status": "rejected", "reason": notes},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    return standard_response(True, "Verification rejected")


@router.put("/posts/{post_id}/status")
def update_post_status_admin(
    post_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    """Admin can update a post's active status, persist removal reason, and notify the user."""
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    is_active = body.get("is_active", post.is_active)
    reason = (body.get("reason") or "").strip() or None
    post.is_active = is_active
    # Persist removal reason; clear it when restoring
    if hasattr(post, 'removal_reason'):
        post.removal_reason = None if is_active else reason
    post.updated_at = datetime.now(EAT)
    db.commit()
    # Notify user
    if post.user_id:
        status_word = "restored" if is_active else "removed"
        reason_suffix = f" Reason: {reason}" if reason and not is_active else ""
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=post.user_id,
            type=NotificationTypeEnum.system,
            message_template=f"Your post has been {status_word} by an administrator.{reason_suffix}",
            message_data={"post_id": str(post.id), "status": status_word, "reason": reason},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    return standard_response(True, f"Post {status_word}")


# ──────────────────────────────────────────────
# NOTIFICATIONS BROADCAST
# ──────────────────────────────────────────────


@router.post("/notifications/broadcast")
def broadcast_notification(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    title = body.get("title", "").strip()
    message = body.get("message", "").strip()
    if not title or not message:
        return standard_response(False, "Title and message are required")
    
    # Get all active users
    users = db.query(User).filter(User.is_active == True).all()
    now = datetime.now(EAT)
    batch = []
    for user in users:
        n = Notification(
            id=uuid.uuid4(),
            recipient_id=user.id,
            type=NotificationTypeEnum.system,
            message_template=f"{title}: {message}",
            message_data={"title": title, "message": message},
            is_read=False,
            created_at=now,
        )
        batch.append(n)
    db.bulk_save_objects(batch)
    db.commit()
    return standard_response(True, f"Notification sent to {len(batch)} users")


# ──────────────────────────────────────────────
# POSTS (FEEDS) ADMIN
# ──────────────────────────────────────────────

@router.get("/posts")
def list_posts_admin(
    page: int = 1, limit: int = 20,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(UserFeed).options(
        joinedload(UserFeed.user).joinedload(User.profile),
        joinedload(UserFeed.images),
    )
    if q:
        query = query.filter(UserFeed.content.ilike(f"%{q}%"))
    query = query.order_by(UserFeed.created_at.desc(), UserFeed.id.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for p in items:
        u = p.user
        profile = u.profile if u else None
        # Live counts from junction tables — never stale denormalized columns
        live_glows = db.query(func.count(UserFeedGlow.id)).filter(
            UserFeedGlow.feed_id == p.id
        ).scalar() or 0
        live_comments = db.query(func.count(UserFeedComment.id)).filter(
            UserFeedComment.feed_id == p.id,
            UserFeedComment.is_active == True,
        ).scalar() or 0
        data.append({
            "id": str(p.id),
            "content": p.content,
            "is_active": p.is_active,
            "removal_reason": p.removal_reason if hasattr(p, 'removal_reason') else None,
            "glow_count": live_glows,
            "echo_count": live_comments,
            "comment_count": live_comments,
            "location": p.location,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "images": [{"url": img.image_url} for img in (p.images or [])],
            "user": {
                "id": str(u.id) if u else None,
                "name": f"{u.first_name} {u.last_name}" if u else None,
                "username": u.username if u else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if u else None,
        })
    return standard_response(True, "Posts retrieved", data, pagination=pagination)


@router.delete("/posts/{post_id}")
def delete_post_admin(post_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    post.is_active = False
    post.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Post removed")


# ──────────────────────────────────────────────
# MOMENTS ADMIN
# ──────────────────────────────────────────────

@router.get("/moments")
def list_moments_admin(
    page: int = 1, limit: int = 20,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(UserMoment).options(
        joinedload(UserMoment.user).joinedload(User.profile),
    )
    if q:
        query = query.filter(UserMoment.caption.ilike(f"%{q}%"))
    query = query.order_by(UserMoment.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for m in items:
        u = m.user
        profile = u.profile if u else None
        data.append({
            "id": str(m.id),
            "caption": m.caption,
            "content_type": m.content_type.value if hasattr(m.content_type, 'value') else str(m.content_type),
            "media_url": m.media_url,
            "is_active": m.is_active,
            "view_count": m.view_count,
            "privacy": m.privacy.value if hasattr(m.privacy, 'value') else str(m.privacy),
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "user": {
                "id": str(u.id) if u else None,
                "name": f"{u.first_name} {u.last_name}" if u else None,
                "username": u.username if u else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if u else None,
        })
    return standard_response(True, "Moments retrieved", data, pagination=pagination)


@router.delete("/moments/{moment_id}")
def delete_moment_admin(moment_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID")
    moment = db.query(UserMoment).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")
    moment.is_active = False
    db.commit()
    return standard_response(True, "Moment removed")


# ──────────────────────────────────────────────
# COMMUNITIES ADMIN
# ──────────────────────────────────────────────

@router.get("/communities")
def list_communities_admin(
    page: int = 1, limit: int = 20,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(Community).options(
        joinedload(Community.creator).joinedload(User.profile),
    )
    if q:
        query = query.filter(Community.name.ilike(f"%{q}%"))
    query = query.order_by(Community.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for c in items:
        creator = c.creator
        profile = creator.profile if creator else None
        data.append({
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "cover_image_url": c.cover_image_url,
            "is_public": c.is_public,
            "member_count": c.member_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "creator": {
                "id": str(creator.id) if creator else None,
                "name": f"{creator.first_name} {creator.last_name}" if creator else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if creator else None,
        })
    return standard_response(True, "Communities retrieved", data, pagination=pagination)


@router.get("/communities/{community_id}")
def get_community_detail_admin(community_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    community = db.query(Community).options(
        joinedload(Community.creator).joinedload(User.profile),
    ).filter(Community.id == cid).first()
    if not community:
        return standard_response(False, "Community not found")

    # Members with avatars
    members_q = (
        db.query(CommunityMember)
        .options(joinedload(CommunityMember.user).joinedload(User.profile))
        .filter(CommunityMember.community_id == cid)
        .order_by(CommunityMember.joined_at.asc())
        .limit(100)
        .all()
    )
    members_data = []
    for m in members_q:
        u = m.user
        prof = u.profile if u else None
        members_data.append({
            "id": str(m.id),
            "role": m.role,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            "user": {
                "id": str(u.id) if u else None,
                "name": f"{u.first_name} {u.last_name}" if u else None,
                "avatar": prof.profile_picture_url if prof else None,
            } if u else None,
        })

    # Recent posts with images and glow counts
    posts_q = (
        db.query(CommunityPost)
        .options(
            joinedload(CommunityPost.author).joinedload(User.profile),
            joinedload(CommunityPost.images),
        )
        .filter(CommunityPost.community_id == cid)
        .order_by(CommunityPost.created_at.desc())
        .limit(50)
        .all()
    )
    posts_data = []
    for p in posts_q:
        author = p.author
        author_prof = author.profile if author else None
        glow_count = db.query(func.count(CommunityPostGlow.id)).filter(CommunityPostGlow.post_id == p.id).scalar() or 0
        posts_data.append({
            "id": str(p.id),
            "content": p.content,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "glow_count": glow_count,
            "author": {
                "id": str(author.id) if author else None,
                "name": f"{author.first_name} {author.last_name}" if author else None,
                "avatar": author_prof.profile_picture_url if author_prof else None,
            } if author else None,
            "images": [{"id": str(img.id), "image_url": img.image_url} for img in (p.images or [])],
        })

    creator = community.creator
    creator_prof = creator.profile if creator else None
    detail = {
        "id": str(community.id),
        "name": community.name,
        "description": community.description,
        "cover_image_url": community.cover_image_url,
        "is_public": community.is_public,
        "member_count": community.member_count,
        "post_count": len(posts_data),
        "created_at": community.created_at.isoformat() if community.created_at else None,
        "creator": {
            "id": str(creator.id) if creator else None,
            "name": f"{creator.first_name} {creator.last_name}" if creator else None,
            "avatar": creator_prof.profile_picture_url if creator_prof else None,
        } if creator else None,
        "members": members_data,
        "posts": posts_data,
    }
    return standard_response(True, "Community detail retrieved", detail)


@router.delete("/communities/{community_id}")
def delete_community_admin(community_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")
    community = db.query(Community).filter(Community.id == cid).first()
    if not community:
        return standard_response(False, "Community not found")

    # Collect file URLs before deletion
    cover_url = community.cover_image_url
    post_image_urls = []
    posts = db.query(CommunityPost).filter(CommunityPost.community_id == cid).all()
    from models import CommunityPostImage
    for p in posts:
        images = db.query(CommunityPostImage).filter(CommunityPostImage.post_id == p.id).all()
        post_image_urls.extend([img.image_url for img in images if img.image_url])

    db.delete(community)
    db.commit()

    # Physically unlink storage files (best-effort, synchronous)
    from utils.helpers import delete_storage_file_sync
    if cover_url:
        delete_storage_file_sync(cover_url)
    for url in post_image_urls:
        delete_storage_file_sync(url)

    return standard_response(True, "Community deleted")


# ──────────────────────────────────────────────
# BOOKINGS ADMIN
# ──────────────────────────────────────────────

@router.get("/bookings")
def list_bookings_admin(
    page: int = 1, limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(ServiceBookingRequest).options(
        joinedload(ServiceBookingRequest.requester).joinedload(User.profile),
        joinedload(ServiceBookingRequest.user_service),
    )
    if status:
        query = query.filter(ServiceBookingRequest.status == status)
    query = query.order_by(ServiceBookingRequest.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for b in items:
        requester = b.requester
        profile = requester.profile if requester else None
        service = b.user_service
        data.append({
            "id": str(b.id),
            "status": b.status,
            "proposed_price": float(b.proposed_price) if b.proposed_price else None,
            "quoted_price": float(b.quoted_price) if b.quoted_price else None,
            "message": b.message,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "service": {
                "id": str(service.id) if service else None,
                "name": service.title if service else None,
            } if service else None,
            "requester": {
                "id": str(requester.id) if requester else None,
                "name": f"{requester.first_name} {requester.last_name}" if requester else None,
                "email": requester.email if requester else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if requester else None,
        })
    return standard_response(True, "Bookings retrieved", data, pagination=pagination)


# ──────────────────────────────────────────────
# NURU CARDS ADMIN
# ──────────────────────────────────────────────

@router.get("/nuru-cards")
def list_nuru_cards_admin(
    page: int = 1, limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    query = db.query(NuruCardOrder).options(
        joinedload(NuruCardOrder.user).joinedload(User.profile),
    )
    if status:
        query = query.filter(NuruCardOrder.status == status)
    query = query.order_by(NuruCardOrder.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = []
    for o in items:
        u = o.user
        profile = u.profile if u else None
        data.append({
            "id": str(o.id),
            "card_type": o.card_type.value if hasattr(o.card_type, 'value') else str(o.card_type),
            "quantity": o.quantity,
            "status": o.status.value if hasattr(o.status, 'value') else str(o.status),
            "payment_status": o.payment_status.value if hasattr(o.payment_status, 'value') else str(o.payment_status),
            "amount": float(o.amount) if o.amount else None,
            "delivery_city": o.delivery_city,
            "delivery_address": o.delivery_address,
            "tracking_number": o.tracking_number,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "user": {
                "id": str(u.id) if u else None,
                "name": f"{u.first_name} {u.last_name}" if u else None,
                "email": u.email if u else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if u else None,
        })
    return standard_response(True, "NuruCard orders retrieved", data, pagination=pagination)


@router.put("/nuru-cards/{order_id}/status")
def update_nuru_card_status(
    order_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin)
):
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        return standard_response(False, "Invalid order ID")
    order = db.query(NuruCardOrder).filter(NuruCardOrder.id == oid).first()
    if not order:
        return standard_response(False, "Order not found")
    new_status = body.get("status")
    if new_status:
        try:
            order.status = CardOrderStatusEnum(new_status)
        except ValueError:
            return standard_response(False, "Invalid status")
    if body.get("tracking_number"):
        order.tracking_number = body["tracking_number"]
    order.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Order status updated")


# ──────────────────────────────────────────────
# SERVICE CATEGORIES ADMIN
# ──────────────────────────────────────────────

@router.get("/service-categories")
def list_service_categories_admin(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    cats = db.query(ServiceCategory).order_by(ServiceCategory.name.asc()).all()
    data = [{"id": str(c.id), "name": c.name, "description": c.description if hasattr(c, 'description') else None, "icon": c.icon if hasattr(c, 'icon') else None, "is_active": c.is_active if hasattr(c, 'is_active') else True} for c in cats]
    return standard_response(True, "Service categories retrieved", data)


@router.post("/service-categories")
def create_service_category(body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    name = body.get("name", "").strip()
    if not name:
        return standard_response(False, "Name is required")
    cat = ServiceCategory(id=uuid.uuid4(), name=name)
    if hasattr(cat, 'description'):
        cat.description = body.get("description")
    if hasattr(cat, 'icon'):
        cat.icon = body.get("icon")
    db.add(cat)
    db.commit()
    return standard_response(True, "Service category created", {"id": str(cat.id), "name": cat.name})


@router.put("/service-categories/{cat_id}")
def update_service_category(cat_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(cat_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == cid).first()
    if not cat:
        return standard_response(False, "Category not found")
    if body.get("name"):
        cat.name = body["name"].strip()
    for field in ["description", "icon", "is_active"]:
        if field in body and hasattr(cat, field):
            setattr(cat, field, body[field])
    db.commit()
    return standard_response(True, "Category updated")


@router.delete("/service-categories/{cat_id}")
def delete_service_category(cat_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(cat_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == cid).first()
    if not cat:
        return standard_response(False, "Category not found")
    db.delete(cat)
    db.commit()
    return standard_response(True, "Category deleted")


# ──────────────────────────────────────────────
# SERVICE TYPES PER CATEGORY
# ──────────────────────────────────────────────

@router.get("/service-categories/{cat_id}/service-types")
def list_service_types_by_category(cat_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(cat_id)
    except ValueError:
        return standard_response(False, "Invalid category ID")
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == cid).first()
    if not cat:
        return standard_response(False, "Category not found")
    types = db.query(ServiceType).filter(ServiceType.category_id == cid).order_by(ServiceType.name.asc()).all()
    data = [
        {
            "id": str(t.id),
            "name": t.name,
            "description": t.description if hasattr(t, "description") else None,
            "requires_kyc": t.requires_kyc if hasattr(t, "requires_kyc") else False,
            "category_id": str(t.category_id) if t.category_id else None,
        }
        for t in types
    ]
    return standard_response(True, "Service types retrieved", data)


# ──────────────────────────────────────────────
# KYC DEFINITIONS (master list)
# ──────────────────────────────────────────────

@router.get("/kyc-definitions")
def list_kyc_definitions(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    reqs = db.query(KYCRequirement).order_by(KYCRequirement.name.asc()).all()
    data = [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description if hasattr(r, "description") else None,
        }
        for r in reqs
    ]
    return standard_response(True, "KYC definitions retrieved", data)


# ──────────────────────────────────────────────
# KYC REQUIREMENTS PER SERVICE TYPE
# ──────────────────────────────────────────────

@router.get("/service-types/{type_id}/kyc-requirements")
def list_kyc_requirements_for_type(type_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(type_id)
    except ValueError:
        return standard_response(False, "Invalid service type ID")
    st = db.query(ServiceType).filter(ServiceType.id == tid).first()
    if not st:
        return standard_response(False, "Service type not found")
    mappings = db.query(ServiceKYCMapping).options(
        joinedload(ServiceKYCMapping.kyc_requirement)
    ).filter(ServiceKYCMapping.service_type_id == tid).all()
    data = [
        {
            "mapping_id": str(m.id),
            "id": str(m.id),
            "kyc_requirement_id": str(m.kyc_requirement_id),
            "name": m.kyc_requirement.name if m.kyc_requirement else None,
            "description": m.kyc_requirement.description if m.kyc_requirement else None,
            "is_mandatory": m.is_mandatory,
        }
        for m in mappings
    ]
    return standard_response(True, "KYC requirements retrieved", data)


@router.post("/service-types/{type_id}/kyc-requirements")
def add_kyc_requirement_to_type(type_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(type_id)
    except ValueError:
        return standard_response(False, "Invalid service type ID")
    kyc_req_id_str = body.get("kyc_requirement_id", "")
    try:
        krid = uuid.UUID(kyc_req_id_str)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid kyc_requirement_id")
    st = db.query(ServiceType).filter(ServiceType.id == tid).first()
    if not st:
        return standard_response(False, "Service type not found")
    req = db.query(KYCRequirement).filter(KYCRequirement.id == krid).first()
    if not req:
        return standard_response(False, "KYC requirement not found")
    # Prevent duplicates
    existing = db.query(ServiceKYCMapping).filter(ServiceKYCMapping.service_type_id == tid, ServiceKYCMapping.kyc_requirement_id == krid).first()
    if existing:
        return standard_response(False, "This KYC requirement is already mapped to this service type")
    mapping = ServiceKYCMapping(
        id=uuid.uuid4(),
        service_type_id=tid,
        kyc_requirement_id=krid,
        is_mandatory=body.get("is_mandatory", True),
    )
    db.add(mapping)
    db.commit()
    return standard_response(True, "KYC requirement added", {"mapping_id": str(mapping.id)})


@router.delete("/service-types/{type_id}/kyc-requirements/{mapping_id}")
def remove_kyc_requirement_from_type(type_id: str, mapping_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        tid = uuid.UUID(type_id)
        mid = uuid.UUID(mapping_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    mapping = db.query(ServiceKYCMapping).filter(
        ServiceKYCMapping.id == mid,
        ServiceKYCMapping.service_type_id == tid,
    ).first()
    if not mapping:
        return standard_response(False, "Mapping not found")
    db.delete(mapping)
    db.commit()
    return standard_response(True, "KYC requirement removed")


# ──────────────────────────────────────────────
# DASHBOARD STATS (Extended)
# ──────────────────────────────────────────────

@router.get("/stats/extended")
def get_extended_stats(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    total_posts = db.query(func.count(UserFeed.id)).filter(UserFeed.is_active == True).scalar() or 0
    total_moments = db.query(func.count(UserMoment.id)).filter(UserMoment.is_active == True).scalar() or 0
    total_communities = db.query(func.count(Community.id)).scalar() or 0
    total_bookings = db.query(func.count(ServiceBookingRequest.id)).scalar() or 0
    pending_bookings = db.query(func.count(ServiceBookingRequest.id)).filter(ServiceBookingRequest.status == 'pending').scalar() or 0
    pending_card_orders = db.query(func.count(NuruCardOrder.id)).filter(NuruCardOrder.status == 'pending').scalar() or 0

    return standard_response(True, "Extended stats", {
        "total_posts": total_posts,
        "total_moments": total_moments,
        "total_communities": total_communities,
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "pending_card_orders": pending_card_orders,
    })


# ──────────────────────────────────────────────
# APPEALS ADMIN
# ──────────────────────────────────────────────

@router.get("/appeals")
def list_appeals_admin(
    page: int = 1,
    limit: int = 20,
    status: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List all content appeals with user and content details."""
    query = db.query(ContentAppeal).options(
        joinedload(ContentAppeal.user).joinedload(User.profile),
    )
    if status:
        try:
            query = query.filter(ContentAppeal.status == AppealStatusEnum(status))
        except ValueError:
            pass
    query = query.order_by(ContentAppeal.created_at.desc(), ContentAppeal.id.desc())
    items, pagination = paginate(query, page, limit)

    data = []
    for a in items:
        u = a.user
        profile = u.profile if u else None
        # Resolve content details
        content_preview = None
        content_is_active = None
        media_url = None
        caption = None
        if a.content_type == AppealContentTypeEnum.post:
            post = db.query(UserFeed).filter(UserFeed.id == a.content_id).first()
            if post:
                content_preview = (post.content or "")[:120]
                content_is_active = post.is_active
                caption = post.content
                # Get first image
                first_img = db.query(UserFeedImage).filter(UserFeedImage.feed_id == post.id).first()
                media_url = first_img.image_url if first_img else None
        elif a.content_type == AppealContentTypeEnum.moment:
            moment = db.query(UserMoment).filter(UserMoment.id == a.content_id).first()
            if moment:
                content_preview = moment.caption or ""
                content_is_active = moment.is_active
                media_url = moment.media_url
                caption = moment.caption

        data.append({
            "id": str(a.id),
            "content_id": str(a.content_id),
            "content_type": a.content_type.value,
            "content_preview": content_preview,
            "content_is_active": content_is_active,
            "media_url": media_url,
            "caption": caption,
            "appeal_reason": a.appeal_reason,
            "status": a.status.value,
            "admin_notes": a.admin_notes,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "user": {
                "id": str(u.id) if u else None,
                "name": f"{u.first_name} {u.last_name}" if u else None,
                "username": u.username if u else None,
                "avatar": profile.profile_picture_url if profile else None,
            } if u else None,
        })
    return standard_response(True, "Appeals retrieved", data, pagination=pagination)



@router.put("/appeals/{appeal_id}/approve")
def approve_appeal(
    appeal_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Approve an appeal — restores the content and notifies the user."""
    try:
        aid = uuid.UUID(appeal_id)
    except ValueError:
        return standard_response(False, "Invalid appeal ID")

    appeal = db.query(ContentAppeal).filter(ContentAppeal.id == aid).first()
    if not appeal:
        return standard_response(False, "Appeal not found")
    if appeal.status != AppealStatusEnum.pending:
        return standard_response(False, "This appeal has already been reviewed")

    admin_notes = (body.get("notes") or "").strip()
    appeal.status = AppealStatusEnum.approved
    appeal.admin_notes = admin_notes or "Your appeal has been reviewed and approved."
    appeal.reviewed_by = admin.id
    appeal.reviewed_at = datetime.now(EAT)
    appeal.updated_at = datetime.now(EAT)

    # Restore the content
    if appeal.content_type == AppealContentTypeEnum.post:
        post = db.query(UserFeed).filter(UserFeed.id == appeal.content_id).first()
        if post:
            post.is_active = True
            if hasattr(post, 'removal_reason'):
                post.removal_reason = None
    elif appeal.content_type == AppealContentTypeEnum.moment:
        moment = db.query(UserMoment).filter(UserMoment.id == appeal.content_id).first()
        if moment:
            moment.is_active = True
            if hasattr(moment, 'removal_reason'):
                moment.removal_reason = None

    db.commit()

    # Notify user
    notif = Notification(
        id=uuid.uuid4(),
        recipient_id=appeal.user_id,
        type=NotificationTypeEnum.system,
        message_template=f"Great news! Your appeal was approved and your {appeal.content_type.value} has been restored.",
        message_data={"appeal_id": str(appeal.id), "content_type": appeal.content_type.value},
        is_read=False,
        created_at=datetime.now(EAT),
    )
    db.add(notif)
    db.commit()
    return standard_response(True, "Appeal approved and content restored")


@router.put("/appeals/{appeal_id}/reject")
def reject_appeal(
    appeal_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Reject an appeal — content stays removed, user is notified."""
    try:
        aid = uuid.UUID(appeal_id)
    except ValueError:
        return standard_response(False, "Invalid appeal ID")

    appeal = db.query(ContentAppeal).filter(ContentAppeal.id == aid).first()
    if not appeal:
        return standard_response(False, "Appeal not found")
    if appeal.status != AppealStatusEnum.pending:
        return standard_response(False, "This appeal has already been reviewed")

    admin_notes = (body.get("notes") or "").strip()
    if not admin_notes:
        return standard_response(False, "Rejection reason is required")

    appeal.status = AppealStatusEnum.rejected
    appeal.admin_notes = admin_notes
    appeal.reviewed_by = admin.id
    appeal.reviewed_at = datetime.now(EAT)
    appeal.updated_at = datetime.now(EAT)
    db.commit()

    # Notify user
    notif = Notification(
        id=uuid.uuid4(),
        recipient_id=appeal.user_id,
        type=NotificationTypeEnum.system,
        message_template=f"Your appeal has been reviewed and unfortunately rejected. Reason: {admin_notes}",
        message_data={"appeal_id": str(appeal.id), "reason": admin_notes},
        is_read=False,
        created_at=datetime.now(EAT),
    )
    db.add(notif)
    db.commit()
    return standard_response(True, "Appeal rejected")


# ──────────────────────────────────────────────
# UNIFIED REVIEW ENDPOINT (approve OR reject via single call)
# Frontend calls PUT /admin/appeals/{id}/review with { decision, notes }
# ──────────────────────────────────────────────

@router.put("/appeals/{appeal_id}/review")
def review_appeal(
    appeal_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Unified endpoint: { decision: 'approved'|'rejected', notes: '...' }"""
    decision = (body.get("decision") or "").strip().lower()
    if decision not in ("approved", "rejected"):
        return standard_response(False, "decision must be 'approved' or 'rejected'")

    try:
        aid = uuid.UUID(appeal_id)
    except ValueError:
        return standard_response(False, "Invalid appeal ID")

    appeal = db.query(ContentAppeal).filter(ContentAppeal.id == aid).first()
    if not appeal:
        return standard_response(False, "Appeal not found")
    if appeal.status != AppealStatusEnum.pending:
        return standard_response(False, "This appeal has already been reviewed")

    admin_notes = (body.get("notes") or "").strip()
    if decision == "rejected" and not admin_notes:
        return standard_response(False, "Rejection reason is required")

    appeal.status = AppealStatusEnum.approved if decision == "approved" else AppealStatusEnum.rejected
    appeal.admin_notes = admin_notes or ("Your appeal has been reviewed and approved." if decision == "approved" else admin_notes)
    appeal.reviewed_by = admin.id
    appeal.reviewed_at = datetime.now(EAT)
    appeal.updated_at = datetime.now(EAT)

    if decision == "approved":
        if appeal.content_type == AppealContentTypeEnum.post:
            post = db.query(UserFeed).filter(UserFeed.id == appeal.content_id).first()
            if post:
                post.is_active = True
                if hasattr(post, 'removal_reason'):
                    post.removal_reason = None
        elif appeal.content_type == AppealContentTypeEnum.moment:
            moment = db.query(UserMoment).filter(UserMoment.id == appeal.content_id).first()
            if moment:
                moment.is_active = True
                if hasattr(moment, 'removal_reason'):
                    moment.removal_reason = None

    db.commit()

    msg = (
        f"Great news! Your appeal was approved and your {appeal.content_type.value} has been restored."
        if decision == "approved"
        else f"Your appeal was reviewed and unfortunately rejected. Reason: {admin_notes}"
    )
    notif = Notification(
        id=uuid.uuid4(),
        recipient_id=appeal.user_id,
        type=NotificationTypeEnum.system,
        message_template=msg,
        message_data={"appeal_id": str(appeal.id), "decision": decision, "content_type": appeal.content_type.value},
        is_read=False,
        created_at=datetime.now(EAT),
    )
    db.add(notif)
    db.commit()
    return standard_response(True, f"Appeal {decision}")


# ──────────────────────────────────────────────
# ISSUE CATEGORIES MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/issue-categories")
def admin_list_issue_categories(db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    cats = db.query(IssueCategory).order_by(IssueCategory.display_order.asc(), IssueCategory.name.asc()).all()
    data = [{
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "icon": c.icon,
        "display_order": c.display_order,
        "is_active": c.is_active,
        "issue_count": db.query(func.count(Issue.id)).filter(Issue.category_id == c.id).scalar() or 0,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in cats]
    return standard_response(True, "Issue categories retrieved", data)


@router.post("/issue-categories")
def admin_create_issue_category(body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        return standard_response(False, "Category name is required")
    if db.query(IssueCategory).filter(IssueCategory.name == name).first():
        return standard_response(False, "Category name already exists")
    cat = IssueCategory(
        name=name,
        description=(body.get("description") or "").strip() or None,
        icon=(body.get("icon") or "").strip() or None,
        display_order=body.get("display_order", 0),
        is_active=body.get("is_active", True),
    )
    db.add(cat)
    db.commit()
    return standard_response(True, "Issue category created", {"id": str(cat.id), "name": cat.name})


@router.put("/issue-categories/{cat_id}")
def admin_update_issue_category(cat_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(cat_id)
    except ValueError:
        return standard_response(False, "Invalid category ID")
    cat = db.query(IssueCategory).filter(IssueCategory.id == cid).first()
    if not cat:
        return standard_response(False, "Category not found")
    if "name" in body and body["name"]:
        existing = db.query(IssueCategory).filter(IssueCategory.name == body["name"].strip(), IssueCategory.id != cid).first()
        if existing:
            return standard_response(False, "Category name already exists")
        cat.name = body["name"].strip()
    if "description" in body:
        cat.description = (body["description"] or "").strip() or None
    if "icon" in body:
        cat.icon = (body["icon"] or "").strip() or None
    if "display_order" in body:
        cat.display_order = body["display_order"]
    if "is_active" in body:
        cat.is_active = body["is_active"]
    cat.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Issue category updated")


@router.delete("/issue-categories/{cat_id}")
def admin_delete_issue_category(cat_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        cid = uuid.UUID(cat_id)
    except ValueError:
        return standard_response(False, "Invalid category ID")
    cat = db.query(IssueCategory).filter(IssueCategory.id == cid).first()
    if not cat:
        return standard_response(False, "Category not found")
    issue_count = db.query(func.count(Issue.id)).filter(Issue.category_id == cid).scalar() or 0
    if issue_count > 0:
        return standard_response(False, f"Cannot delete: {issue_count} issue(s) use this category. Deactivate instead.")
    db.delete(cat)
    db.commit()
    return standard_response(True, "Issue category deleted")


# ──────────────────────────────────────────────
# ADMIN ISSUE MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/issues")
def admin_list_issues(
    page: int = 1, limit: int = 20,
    status: str = None, q: str = None, category_id: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    query = db.query(Issue).options(
        joinedload(Issue.category),
        joinedload(Issue.user).joinedload(User.profile),
    )
    if status:
        try:
            query = query.filter(Issue.status == IssueStatusEnum(status))
        except ValueError:
            pass
    if q:
        search = f"%{q}%"
        query = query.filter(or_(Issue.subject.ilike(search), Issue.description.ilike(search)))
    if category_id:
        try:
            query = query.filter(Issue.category_id == uuid.UUID(category_id))
        except ValueError:
            pass
    query = query.order_by(Issue.created_at.desc(), Issue.id.desc())
    items, pagination = paginate(query, page, limit)

    data = []
    for issue in items:
        response_count = db.query(func.count(IssueResponse.id)).filter(IssueResponse.issue_id == issue.id).scalar() or 0
        user_name = f"{issue.user.first_name} {issue.user.last_name}" if issue.user else "Unknown"
        user_avatar = issue.user.profile.profile_picture_url if issue.user and issue.user.profile else None
        data.append({
            "id": str(issue.id),
            "subject": issue.subject,
            "description": issue.description[:150] + "..." if len(issue.description or "") > 150 else issue.description,
            "status": issue.status.value if issue.status else "open",
            "priority": issue.priority.value if issue.priority else "medium",
            "category": {"id": str(issue.category.id), "name": issue.category.name, "icon": issue.category.icon} if issue.category else None,
            "user": {"id": str(issue.user_id), "name": user_name, "avatar": user_avatar, "username": issue.user.username if issue.user else None},
            "screenshot_urls": issue.screenshot_urls or [],
            "response_count": response_count,
            "created_at": issue.created_at.isoformat() if issue.created_at else None,
            "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
        })

    # Summary
    total = db.query(func.count(Issue.id)).scalar() or 0
    open_count = db.query(func.count(Issue.id)).filter(Issue.status == IssueStatusEnum.open).scalar() or 0
    in_progress_count = db.query(func.count(Issue.id)).filter(Issue.status == IssueStatusEnum.in_progress).scalar() or 0
    resolved_count = db.query(func.count(Issue.id)).filter(Issue.status == IssueStatusEnum.resolved).scalar() or 0

    return standard_response(True, "Issues retrieved", {
        "issues": data,
        "summary": {"total": total, "open": open_count, "in_progress": in_progress_count, "resolved": resolved_count},
    }, pagination=pagination)


@router.get("/issues/{issue_id}")
def admin_get_issue_detail(issue_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        iid = uuid.UUID(issue_id)
    except ValueError:
        return standard_response(False, "Invalid issue ID")

    issue = db.query(Issue).options(
        joinedload(Issue.category),
        joinedload(Issue.user).joinedload(User.profile),
        joinedload(Issue.responses),
    ).filter(Issue.id == iid).first()
    if not issue:
        return standard_response(False, "Issue not found")

    user_name = f"{issue.user.first_name} {issue.user.last_name}" if issue.user else "Unknown"
    user_avatar = issue.user.profile.profile_picture_url if issue.user and issue.user.profile else None

    responses = [{
        "id": str(r.id),
        "message": r.message,
        "is_admin": r.is_admin,
        "admin_name": r.admin_name,
        "responder_id": str(r.responder_id) if r.responder_id else None,
        "attachments": r.attachments or [],
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in (issue.responses or [])]

    return standard_response(True, "Issue retrieved", {
        "id": str(issue.id),
        "subject": issue.subject,
        "description": issue.description,
        "status": issue.status.value if issue.status else "open",
        "priority": issue.priority.value if issue.priority else "medium",
        "category": {"id": str(issue.category.id), "name": issue.category.name, "icon": issue.category.icon} if issue.category else None,
        "user": {"id": str(issue.user_id), "name": user_name, "avatar": user_avatar, "username": issue.user.username if issue.user else None, "email": issue.user.email if issue.user else None},
        "screenshot_urls": issue.screenshot_urls or [],
        "responses": responses,
        "created_at": issue.created_at.isoformat() if issue.created_at else None,
        "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
    })


@router.put("/issues/{issue_id}/status")
def admin_update_issue_status(issue_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        iid = uuid.UUID(issue_id)
    except ValueError:
        return standard_response(False, "Invalid issue ID")

    issue = db.query(Issue).filter(Issue.id == iid).first()
    if not issue:
        return standard_response(False, "Issue not found")

    new_status = (body.get("status") or "").strip()
    try:
        status_enum = IssueStatusEnum(new_status)
    except ValueError:
        return standard_response(False, f"Invalid status. Must be one of: {[s.value for s in IssueStatusEnum]}")

    issue.status = status_enum
    issue.updated_at = datetime.now(EAT)
    db.commit()

    # Notify user
    status_labels = {"open": "reopened", "in_progress": "being reviewed", "resolved": "resolved", "closed": "closed"}
    notif = Notification(
        id=uuid.uuid4(),
        recipient_id=issue.user_id,
        type=NotificationTypeEnum.system,
        message_template=f"Your issue \"{issue.subject}\" has been {status_labels.get(new_status, new_status)}.",
        message_data={"issue_id": str(issue.id), "status": new_status},
        is_read=False,
        created_at=datetime.now(EAT),
    )
    db.add(notif)
    db.commit()

    return standard_response(True, f"Issue status updated to {new_status}")


@router.post("/issues/{issue_id}/reply")
def admin_reply_to_issue(issue_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        iid = uuid.UUID(issue_id)
    except ValueError:
        return standard_response(False, "Invalid issue ID")

    issue = db.query(Issue).filter(Issue.id == iid).first()
    if not issue:
        return standard_response(False, "Issue not found")

    message = (body.get("message") or "").strip()
    if not message:
        return standard_response(False, "Message is required")

    now = datetime.now(EAT)
    response = IssueResponse(
        id=uuid.uuid4(),
        issue_id=iid,
        responder_id=admin.id,
        is_admin=True,
        admin_name=admin.full_name,
        message=message,
        created_at=now,
    )
    db.add(response)

    # Auto-set to in_progress if still open
    if issue.status == IssueStatusEnum.open:
        issue.status = IssueStatusEnum.in_progress
    issue.updated_at = now
    db.commit()

    # Notify user
    notif = Notification(
        id=uuid.uuid4(),
        recipient_id=issue.user_id,
        type=NotificationTypeEnum.system,
        message_template=f"You received a response on your issue \"{issue.subject}\".",
        message_data={"issue_id": str(issue.id)},
        is_read=False,
        created_at=now,
    )
    db.add(notif)
    db.commit()

    return standard_response(True, "Reply sent", {"id": str(response.id)})


@router.put("/issues/{issue_id}/priority")
def admin_update_issue_priority(issue_id: str, body: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    try:
        iid = uuid.UUID(issue_id)
    except ValueError:
        return standard_response(False, "Invalid issue ID")

    issue = db.query(Issue).filter(Issue.id == iid).first()
    if not issue:
        return standard_response(False, "Issue not found")

    new_priority = (body.get("priority") or "").strip()
    try:
        priority_enum = IssuePriorityEnum(new_priority)
    except ValueError:
        return standard_response(False, f"Invalid priority. Must be one of: {[p.value for p in IssuePriorityEnum]}")

    issue.priority = priority_enum
    issue.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, f"Issue priority updated to {new_priority}")


# ──────────────────────────────────────────────
# AGREEMENTS MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/agreements/versions")
def admin_list_agreement_versions(
    agreement_type: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List all agreement versions, optionally filtered by type."""
    q = db.query(AgreementVersion).order_by(desc(AgreementVersion.agreement_type), desc(AgreementVersion.version))
    if agreement_type:
        try:
            ag_type = AgreementTypeEnum[agreement_type]
            q = q.filter(AgreementVersion.agreement_type == ag_type)
        except KeyError:
            return standard_response(False, "Invalid agreement type")

    versions = q.all()
    items = []
    for v in versions:
        # Count acceptances for this version
        acceptance_count = db.query(func.count(UserAgreementAcceptance.id)).filter(
            UserAgreementAcceptance.agreement_version_id == v.id
        ).scalar() or 0

        items.append({
            "id": str(v.id),
            "agreement_type": v.agreement_type.name,
            "version": v.version,
            "summary": v.summary,
            "document_path": v.document_path,
            "published_at": v.published_at.isoformat() if v.published_at else None,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "acceptance_count": acceptance_count,
        })

    return standard_response(True, "Agreement versions", items)


@router.post("/agreements/versions")
async def admin_create_agreement_version(
    request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Publish a new agreement version."""
    try:
        body = await request.json()
    except Exception:
        return standard_response(False, "Invalid JSON")

    agreement_type = (body.get("agreement_type") or "").strip()
    summary = (body.get("summary") or "").strip()
    document_path = (body.get("document_path") or "").strip()

    if not agreement_type or not document_path:
        return standard_response(False, "agreement_type and document_path are required")

    try:
        ag_type = AgreementTypeEnum[agreement_type]
    except KeyError:
        return standard_response(False, f"Invalid agreement type. Must be one of: {[e.name for e in AgreementTypeEnum]}")

    # Determine next version number
    latest = (
        db.query(AgreementVersion)
        .filter(AgreementVersion.agreement_type == ag_type)
        .order_by(desc(AgreementVersion.version))
        .first()
    )
    next_version = (latest.version + 1) if latest else 1

    new_ver = AgreementVersion(
        agreement_type=ag_type,
        version=next_version,
        summary=summary or None,
        document_path=document_path,
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)

    return standard_response(True, f"Version {next_version} published", {
        "id": str(new_ver.id),
        "agreement_type": ag_type.name,
        "version": next_version,
        "summary": new_ver.summary,
        "document_path": new_ver.document_path,
    })


@router.get("/agreements/acceptances")
def admin_list_acceptances(
    agreement_type: str = None,
    version: int = None,
    page: int = 1,
    limit: int = 20,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List user acceptances with user info, filterable."""
    query = (
        db.query(UserAgreementAcceptance, User, UserProfile)
        .join(User, User.id == UserAgreementAcceptance.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(desc(UserAgreementAcceptance.accepted_at))
    )

    if agreement_type:
        try:
            ag_type = AgreementTypeEnum[agreement_type]
            query = query.filter(UserAgreementAcceptance.agreement_type == ag_type)
        except KeyError:
            return standard_response(False, "Invalid agreement type")

    if version:
        query = query.filter(UserAgreementAcceptance.version_accepted == version)

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                User.email.ilike(search),
                User.phone.ilike(search),
                UserProfile.first_name.ilike(search),
                UserProfile.last_name.ilike(search),
            )
        )

    total = query.count()
    offset = (page - 1) * limit
    records = query.offset(offset).limit(limit).all()

    items = []
    for acceptance, user, profile in records:
        items.append({
            "id": str(acceptance.id),
            "user_id": str(user.id),
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "user_email": user.email,
            "user_avatar": profile.profile_picture_url if profile else None,
            "agreement_type": acceptance.agreement_type.name,
            "version_accepted": acceptance.version_accepted,
            "ip_address": acceptance.ip_address,
            "user_agent": acceptance.user_agent,
            "accepted_at": acceptance.accepted_at.isoformat() if acceptance.accepted_at else None,
        })

    return standard_response(True, "Acceptances", {
        "items": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
        }
    })


# ──────────────────────────────────────────────
# Ticketed Events Approval
# ──────────────────────────────────────────────

def _resolve_event_cover_admin(event, db):
    """Resolve best cover image for admin view."""
    if event.cover_image_url:
        return event.cover_image_url
    img = db.query(EventImage).filter(EventImage.event_id == event.id).order_by(
        EventImage.is_featured.desc(), EventImage.created_at.asc()
    ).first()
    return img.image_url if img else None


@router.get("/ticketed-events")
def get_ticketed_events_admin(
    page: int = 1,
    limit: int = 20,
    status: str = None,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List all events with sells_tickets=True for admin approval."""
    from sqlalchemy import func as sa_func

    query = db.query(Event).filter(Event.sells_tickets == True)

    if status:
        try:
            query = query.filter(Event.ticket_approval_status == TicketApprovalStatusEnum(status))
        except (ValueError, KeyError):
            pass

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Event.name).like(term),
                func.lower(Event.location).like(term),
            )
        )

    query = query.order_by(Event.created_at.desc(), Event.id.desc())
    total = query.count()
    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit
    events = query.offset(offset).limit(limit).all()

    result = []
    for e in events:
        organizer = db.query(User).filter(User.id == e.organizer_id).first()
        ticket_classes = db.query(EventTicketClass).filter(EventTicketClass.event_id == e.id).all()
        total_qty = sum([tc.quantity for tc in ticket_classes])
        total_sold = db.query(sa_func.coalesce(sa_func.sum(EventTicket.quantity), 0)).filter(
            EventTicket.event_id == e.id,
            EventTicket.status.notin_([TicketOrderStatusEnum.rejected, TicketOrderStatusEnum.cancelled]),
        ).scalar()
        result.append({
            "id": str(e.id),
            "name": e.name,
            "organizer_name": f"{organizer.first_name} {organizer.last_name}" if organizer else "Unknown",
            "organizer_id": str(e.organizer_id) if e.organizer_id else None,
            "start_date": e.start_date.isoformat() if e.start_date else None,
            "location": e.location,
            "cover_image": _resolve_event_cover_admin(e, db),
            "ticket_approval_status": e.ticket_approval_status.value if e.ticket_approval_status else "pending",
            "ticket_rejection_reason": e.ticket_rejection_reason,
            "ticket_removed_reason": e.ticket_removed_reason,
            "ticket_class_count": len(ticket_classes),
            "total_tickets": total_qty,
            "total_sold": int(total_sold),
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return standard_response(True, "Ticketed events", {
        "items": result,
        "pagination": {
            "page": page, "limit": limit, "total": total,
            "pages": (total + limit - 1) // limit,
        }
    })


@router.put("/ticketed-events/{event_id}/approve")
async def approve_ticketed_event(
    event_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Approve a ticketed event for public visibility."""
    try:
        eid = uuid.UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.sells_tickets == True).first()
    if not event:
        return standard_response(False, "Ticketed event not found")

    event.ticket_approval_status = TicketApprovalStatusEnum.approved
    event.ticket_approved_by = admin.id
    event.ticket_approved_at = datetime.now(EAT)
    event.ticket_rejection_reason = None
    db.commit()

    # Notify organizer
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=event.organizer_id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template=f"Your ticketed event \"{event.name}\" has been approved! Tickets are now live.",
            message_data={"event_id": str(event.id), "event_name": event.name, "action": "ticket_approved"},
            reference_id=event.id,
            reference_type="event",
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Ticketed event approved")


@router.put("/ticketed-events/{event_id}/reject")
async def reject_ticketed_event(
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Reject a ticketed event with a reason."""
    try:
        eid = uuid.UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.sells_tickets == True).first()
    if not event:
        return standard_response(False, "Ticketed event not found")

    payload = await request.json()
    reason = (payload.get("reason") or "").strip()
    if not reason:
        return standard_response(False, "Rejection reason is required")

    event.ticket_approval_status = TicketApprovalStatusEnum.rejected
    event.ticket_rejection_reason = reason
    db.commit()

    # Notify organizer
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=event.organizer_id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template=f"Your ticketed event \"{event.name}\" was rejected. Reason: {reason}",
            message_data={"event_id": str(event.id), "event_name": event.name, "action": "ticket_rejected", "reason": reason},
            reference_id=event.id,
            reference_type="event",
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Ticketed event rejected")


@router.put("/ticketed-events/{event_id}/remove")
async def remove_ticketed_event(
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Soft-remove a ticketed event (not delete). Tickets are disabled."""
    try:
        eid = uuid.UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.sells_tickets == True).first()
    if not event:
        return standard_response(False, "Ticketed event not found")

    payload = await request.json()
    reason = (payload.get("reason") or "").strip()
    if not reason:
        return standard_response(False, "Removal reason is required")

    event.ticket_approval_status = TicketApprovalStatusEnum.removed
    event.ticket_removed_reason = reason
    event.ticket_removed_at = datetime.now(EAT)
    db.commit()

    # Notify organizer
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=event.organizer_id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template=f"Your ticketed event \"{event.name}\" has been removed by an administrator. Reason: {reason}",
            message_data={"event_id": str(event.id), "event_name": event.name, "action": "ticket_removed", "reason": reason},
            reference_id=event.id,
            reference_type="event",
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Ticketed event removed")


@router.delete("/ticketed-events/{event_id}")
def delete_ticketed_event_permanently(
    event_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Permanently delete a ticketed event's ticketing data (ticket classes + tickets)."""
    try:
        eid = uuid.UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.sells_tickets == True).first()
    if not event:
        return standard_response(False, "Ticketed event not found")

    # Delete all tickets and ticket classes
    db.query(EventTicket).filter(EventTicket.event_id == eid).delete()
    db.query(EventTicketClass).filter(EventTicketClass.event_id == eid).delete()

    # Reset ticketing flags
    event.sells_tickets = False
    event.ticket_approval_status = TicketApprovalStatusEnum.pending
    event.ticket_rejection_reason = None
    event.ticket_removed_reason = None
    event.ticket_approved_by = None
    event.ticket_approved_at = None
    event.ticket_removed_at = None
    db.commit()

    # Notify organizer
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=event.organizer_id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template=f"Your ticketed event \"{event.name}\" has been permanently removed by an administrator. All ticket classes and orders have been deleted.",
            message_data={"event_id": str(event.id), "event_name": event.name, "action": "ticket_deleted"},
            reference_id=event.id,
            reference_type="event",
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Ticketed event permanently deleted")


# ──────────────────────────────────────────────
# ACCOUNT SUSPENSION
# ──────────────────────────────────────────────

@router.put("/users/{user_id}/suspend")
def suspend_user(user_id: str, request_data: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    """Suspend a user account with a reason."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    reason = (request_data.get("reason") or "").strip()
    if not reason:
        return standard_response(False, "Suspension reason is required")
    user.is_suspended = True
    user.suspension_reason = reason
    user.updated_at = datetime.now(EAT)
    db.commit()

    # Send notification
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=user.id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template=f"Your account has been suspended. Reason: {reason}. Contact support@nuru.tz for assistance.",
            message_data={"action": "account_suspended", "reason": reason},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass

    return standard_response(True, "User suspended")


@router.put("/users/{user_id}/unsuspend")
def unsuspend_user(user_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    """Remove suspension from a user account."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    user.is_suspended = False
    user.suspension_reason = None
    user.updated_at = datetime.now(EAT)
    db.commit()

    # Notify user
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=user.id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template="Your account suspension has been lifted. Welcome back!",
            message_data={"action": "account_unsuspended"},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass

    return standard_response(True, "User unsuspended")


@router.post("/users/{user_id}/notify-invalid-name")
def notify_invalid_name(user_id: str, request_data: dict = Body(...), db: Session = Depends(get_db), admin: AdminUser = Depends(require_admin)):
    """Send notification to user about invalid name, warning of suspension."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")
    
    message = (request_data.get("message") or "").strip()
    if not message:
        message = (
            f"We noticed your account name ({user.first_name} {user.last_name}) may not be a real name. "
            "Please update your profile with your real name or business name. "
            "Accounts with invalid names may be suspended. Contact support@nuru.tz if you need help."
        )

    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=user.id,
            sender_ids=[],
            type=NotificationTypeEnum.system,
            message_template=message,
            message_data={"action": "invalid_name_warning"},
            is_read=False,
            created_at=datetime.now(EAT),
        )
        db.add(notif)
        db.commit()
    except Exception:
        return standard_response(False, "Failed to send notification")

    return standard_response(True, "Notification sent to user")


# ──────────────────────────────────────────────
# NAME VALIDATION FLAGS
# ──────────────────────────────────────────────

@router.get("/name-flags")
def get_name_flags(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query("all"),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List all name validation flags with optional filtering."""
    query = db.query(NameValidationFlag).join(User, NameValidationFlag.user_id == User.id)

    if status == "unresolved":
        query = query.filter(NameValidationFlag.is_resolved == False)
    elif status == "resolved":
        query = query.filter(NameValidationFlag.is_resolved == True)

    total = query.count()
    flags = query.order_by(desc(NameValidationFlag.created_at), desc(NameValidationFlag.id)).offset((page - 1) * limit).limit(limit).all()

    items = []
    for f in flags:
        user = f.user
        items.append({
            "id": str(f.id),
            "user_id": str(f.user_id),
            "user_name": f"{user.first_name} {user.last_name}" if user else "Unknown",
            "user_email": user.email if user else None,
            "user_phone": user.phone if user else None,
            "flagged_first_name": f.flagged_first_name,
            "flagged_last_name": f.flagged_last_name,
            "flag_reason": f.flag_reason,
            "is_resolved": f.is_resolved,
            "resolved_by": f.resolved_by,
            "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
            "admin_notified": f.admin_notified,
            "user_notified": f.user_notified,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })

    return standard_response(True, "Name flags retrieved", {
        "items": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
        }
    })


@router.put("/name-flags/{flag_id}/resolve")
def resolve_name_flag(
    flag_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Mark a name validation flag as resolved."""
    try:
        fid = uuid.UUID(flag_id)
    except ValueError:
        return standard_response(False, "Invalid flag ID")

    flag = db.query(NameValidationFlag).filter(NameValidationFlag.id == fid).first()
    if not flag:
        return standard_response(False, "Flag not found")

    flag.is_resolved = True
    flag.resolved_by = admin.full_name
    flag.resolved_at = datetime.now(EAT)
    flag.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Flag resolved")


@router.delete("/name-flags/{flag_id}")
def delete_name_flag(
    flag_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Delete a name validation flag entirely."""
    try:
        fid = uuid.UUID(flag_id)
    except ValueError:
        return standard_response(False, "Invalid flag ID")

    flag = db.query(NameValidationFlag).filter(NameValidationFlag.id == fid).first()
    if not flag:
        return standard_response(False, "Flag not found")

    db.delete(flag)
    db.commit()

    return standard_response(True, "Flag deleted")
