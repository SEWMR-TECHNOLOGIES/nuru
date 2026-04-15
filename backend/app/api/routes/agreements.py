"""Agreement acceptance API routes."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from core.database import get_db
from models.agreements import AgreementVersion, UserAgreementAcceptance
from models.enums import AgreementTypeEnum
from utils.auth import get_current_user
from utils.helpers import standard_response
from models import User

router = APIRouter(prefix="/agreements", tags=["Agreements"])


@router.get("/check/{agreement_type}")
def check_agreement(
    agreement_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if user has accepted the latest version of an agreement."""
    try:
        ag_type = AgreementTypeEnum[agreement_type]
    except KeyError:
        return standard_response(False, "Invalid agreement type")

    # Get latest version
    latest = (
        db.query(AgreementVersion)
        .filter(AgreementVersion.agreement_type == ag_type)
        .order_by(desc(AgreementVersion.version))
        .first()
    )
    if not latest:
        # No agreement configured, allow through
        return standard_response(True, "No agreement required", {"accepted": True})

    # Check if user accepted this version
    acceptance = (
        db.query(UserAgreementAcceptance)
        .filter(
            UserAgreementAcceptance.user_id == current_user.id,
            UserAgreementAcceptance.agreement_type == ag_type,
            UserAgreementAcceptance.version_accepted == latest.version,
        )
        .first()
    )

    return standard_response(True, "Agreement status", {
        "accepted": acceptance is not None,
        "current_version": latest.version,
        "summary": latest.summary,
        "document_path": latest.document_path,
        "accepted_at": acceptance.accepted_at.isoformat() if acceptance else None,
    })


@router.post("/accept")
async def accept_agreement(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept the latest version of an agreement."""
    try:
        body = await request.json()
    except Exception:
        return standard_response(False, "Invalid JSON body")

    agreement_type = body.get("agreement_type", "").strip()
    try:
        ag_type = AgreementTypeEnum[agreement_type]
    except KeyError:
        return standard_response(False, "Invalid agreement type")

    # Get latest version
    latest = (
        db.query(AgreementVersion)
        .filter(AgreementVersion.agreement_type == ag_type)
        .order_by(desc(AgreementVersion.version))
        .first()
    )
    if not latest:
        return standard_response(False, "No agreement version found")

    # Check if already accepted
    existing = (
        db.query(UserAgreementAcceptance)
        .filter(
            UserAgreementAcceptance.user_id == current_user.id,
            UserAgreementAcceptance.agreement_type == ag_type,
            UserAgreementAcceptance.version_accepted == latest.version,
        )
        .first()
    )
    if existing:
        return standard_response(True, "Already accepted", {
            "accepted": True,
            "version": latest.version,
        })

    # Get IP and user agent
    ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent", "")

    acceptance = UserAgreementAcceptance(
        user_id=current_user.id,
        agreement_version_id=latest.id,
        agreement_type=ag_type,
        version_accepted=latest.version,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(acceptance)
    db.commit()

    return standard_response(True, "Agreement accepted", {
        "accepted": True,
        "version": latest.version,
    })
