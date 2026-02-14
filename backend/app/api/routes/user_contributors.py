# User Contributors Routes - /user-contributors/...
# Handles personal contributor address book & event contributor management

import math
import uuid
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Body, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from models import (
    UserContributor, EventContributor, EventContribution,
    Event, User, Currency,
    EventCommitteeMember, CommitteePermission,
)
from models.enums import PaymentMethodEnum, ContributionStatusEnum
from utils.auth import get_current_user
from utils.helpers import standard_response, format_phone_display
from utils.validation_functions import validate_tanzanian_phone

EAT = pytz.timezone("Africa/Nairobi")

router = APIRouter(prefix="/user-contributors", tags=["User Contributors"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _contributor_dict(c: UserContributor) -> dict:
    return {
        "id": str(c.id),
        "user_id": str(c.user_id),
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _event_contributor_dict(ec: EventContributor, show_recorder: bool = False) -> dict:
    total_paid = sum(float(c.amount or 0) for c in ec.contributions if not hasattr(c, 'confirmation_status') or c.confirmation_status is None or c.confirmation_status == ContributionStatusEnum.confirmed)
    pledge = float(ec.pledge_amount or 0)
    return {
        "id": str(ec.id),
        "event_id": str(ec.event_id),
        "contributor_id": str(ec.contributor_id),
        "contributor": _contributor_dict(ec.contributor) if ec.contributor else None,
        "pledge_amount": pledge,
        "total_paid": total_paid,
        "balance": max(0, pledge - total_paid),
        "notes": ec.notes,
        "created_at": ec.created_at.isoformat() if ec.created_at else None,
        "updated_at": ec.updated_at.isoformat() if ec.updated_at else None,
    }


def _get_event_access(db: Session, event_id, current_user) -> tuple:
    """Returns (event, is_creator, committee_member_or_None, permissions_or_None)"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return None, False, None, None
    is_creator = str(event.organizer_id) == str(current_user.id)
    if is_creator:
        return event, True, None, None
    cm = db.query(EventCommitteeMember).filter(
        EventCommitteeMember.event_id == event_id,
        EventCommitteeMember.user_id == current_user.id,
    ).first()
    if not cm:
        return event, False, None, None
    perms = db.query(CommitteePermission).filter(
        CommitteePermission.committee_member_id == cm.id
    ).first()
    return event, False, cm, perms


def _currency_code(db: Session, event: Event) -> str:
    if event.currency_id:
        cur = db.query(Currency).filter(Currency.id == event.currency_id).first()
        if cur:
            return cur.code.strip()
    return "TZS"


# ══════════════════════════════════════════════
# ADDRESS BOOK (UserContributor CRUD)
# ══════════════════════════════════════════════

@router.get("/")
def get_all_contributors(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(UserContributor).filter(UserContributor.user_id == current_user.id)

    if search:
        like = f"%{search}%"
        q = q.filter(
            (UserContributor.name.ilike(like)) |
            (UserContributor.email.ilike(like)) |
            (UserContributor.phone.ilike(like))
        )

    total = q.count()

    if sort_by == "created_at":
        order_col = UserContributor.created_at
    else:
        order_col = UserContributor.name

    if sort_order == "desc":
        q = q.order_by(order_col.desc())
    else:
        q = q.order_by(order_col.asc())

    contributors = q.offset((page - 1) * limit).limit(limit).all()

    return standard_response(True, "Contributors fetched", {
        "contributors": [_contributor_dict(c) for c in contributors],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit else 1,
        },
    })


@router.get("/{contributor_id}")
def get_contributor(contributor_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(contributor_id)
    except ValueError:
        return standard_response(False, "Invalid contributor ID")

    c = db.query(UserContributor).filter(UserContributor.id == cid, UserContributor.user_id == current_user.id).first()
    if not c:
        return standard_response(False, "Contributor not found")

    return standard_response(True, "Contributor fetched", _contributor_dict(c))


@router.post("/")
def create_contributor(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = (body.get("name") or "").strip()
    if not name:
        return standard_response(False, "Name is required")

    now = datetime.now(EAT)
    phone = (body.get("phone") or "").strip() or None
    if phone:
        try:
            phone = validate_tanzanian_phone(phone)
        except ValueError as e:
            return standard_response(False, str(e))

    # Check phone uniqueness first (DB constraint: user_id + phone)
    if phone:
        existing_phone = db.query(UserContributor).filter(
            UserContributor.user_id == current_user.id,
            UserContributor.phone == phone,
        ).first()
        if existing_phone:
            return standard_response(False, f"A contributor with phone number {format_phone_display(phone)} already exists ({existing_phone.name})")

    # Check name uniqueness
    existing_name = db.query(UserContributor).filter(
        UserContributor.user_id == current_user.id,
        UserContributor.name == name,
    ).first()
    if existing_name:
        return standard_response(False, "A contributor with this name already exists")

    c = UserContributor(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=name,
        email=(body.get("email") or "").strip() or None,
        phone=phone,
        notes=(body.get("notes") or "").strip() or None,
        created_at=now,
        updated_at=now,
    )
    db.add(c)
    db.commit()

    return standard_response(True, "Contributor created", _contributor_dict(c))


@router.put("/{contributor_id}")
def update_contributor(contributor_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(contributor_id)
    except ValueError:
        return standard_response(False, "Invalid contributor ID")

    c = db.query(UserContributor).filter(UserContributor.id == cid, UserContributor.user_id == current_user.id).first()
    if not c:
        return standard_response(False, "Contributor not found")

    if "name" in body and body["name"]:
        c.name = body["name"].strip()
    if "email" in body:
        c.email = (body["email"] or "").strip() or None
    if "phone" in body:
        phone_val = (body["phone"] or "").strip() or None
        if phone_val:
            try:
                phone_val = validate_tanzanian_phone(phone_val)
            except ValueError as e:
                return standard_response(False, str(e))
            # Check phone uniqueness (exclude current contributor)
            existing_phone = db.query(UserContributor).filter(
                UserContributor.user_id == current_user.id,
                UserContributor.phone == phone_val,
                UserContributor.id != cid,
            ).first()
            if existing_phone:
                return standard_response(False, f"Phone number already used by contributor '{existing_phone.name}'")
        c.phone = phone_val
    if "notes" in body:
        c.notes = (body["notes"] or "").strip() or None

    c.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Contributor updated", _contributor_dict(c))


@router.delete("/{contributor_id}")
def delete_contributor(contributor_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(contributor_id)
    except ValueError:
        return standard_response(False, "Invalid contributor ID")

    c = db.query(UserContributor).filter(UserContributor.id == cid, UserContributor.user_id == current_user.id).first()
    if not c:
        return standard_response(False, "Contributor not found")

    db.delete(c)
    db.commit()

    return standard_response(True, "Contributor deleted")


# ══════════════════════════════════════════════
# EVENT CONTRIBUTORS
# ══════════════════════════════════════════════

@router.get("/events/{event_id}/contributors")
def get_event_contributors(
    event_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event, is_creator, cm, perms = _get_event_access(db, eid, current_user)
    if not event:
        return standard_response(False, "Event not found")
    if not is_creator and not cm:
        return standard_response(False, "Event not found or access denied")

    # Use organizer's contributors for non-creators
    owner_id = event.organizer_id

    q = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.event_id == eid)

    if search:
        like = f"%{search}%"
        q = q.join(UserContributor).filter(
            (UserContributor.name.ilike(like)) |
            (UserContributor.email.ilike(like)) |
            (UserContributor.phone.ilike(like))
        )

    total = q.count()
    ecs = q.order_by(EventContributor.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    ec_dicts = [_event_contributor_dict(ec) for ec in ecs]

    total_pledged = sum(d["pledge_amount"] for d in ec_dicts)
    total_paid = sum(d["total_paid"] for d in ec_dicts)
    currency = _currency_code(db, event)

    return standard_response(True, "Event contributors fetched", {
        "event_contributors": ec_dicts,
        "summary": {
            "total_pledged": total_pledged,
            "total_paid": total_paid,
            "total_balance": max(0, total_pledged - total_paid),
            "count": total,
            "currency": currency,
        },
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit else 1,
        },
    })


@router.post("/events/{event_id}/contributors")
def add_to_event(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event, is_creator, cm, perms = _get_event_access(db, eid, current_user)
    if not event:
        return standard_response(False, "Event not found")
    if not is_creator and not cm:
        return standard_response(False, "Event not found or access denied")

    # Use organizer's user_id for contributor address book lookups
    owner_id = event.organizer_id

    now = datetime.now(EAT)
    contributor_id = body.get("contributor_id")

    if contributor_id:
        # Link existing contributor
        try:
            cid = uuid.UUID(contributor_id)
        except ValueError:
            return standard_response(False, "Invalid contributor ID")

        contributor = db.query(UserContributor).filter(UserContributor.id == cid, UserContributor.user_id == owner_id).first()
        if not contributor:
            return standard_response(False, "Contributor not found in address book")
    else:
        # Create new contributor inline
        name = (body.get("name") or "").strip()
        if not name:
            return standard_response(False, "Name is required for new contributors")

        inline_phone = (body.get("phone") or "").strip() or None
        if inline_phone:
            try:
                inline_phone = validate_tanzanian_phone(inline_phone)
            except ValueError as e:
                return standard_response(False, str(e))

        # Look up by phone first (unique constraint), then by name
        contributor = None
        if inline_phone:
            contributor = db.query(UserContributor).filter(
                UserContributor.user_id == owner_id,
                UserContributor.phone == inline_phone,
            ).first()
        if not contributor:
            contributor = db.query(UserContributor).filter(
                UserContributor.user_id == owner_id,
                UserContributor.name == name,
            ).first()

        if not contributor:
            contributor = UserContributor(
                id=uuid.uuid4(),
                user_id=owner_id,
                name=name,
                email=(body.get("email") or "").strip() or None,
                phone=inline_phone,
                created_at=now,
                updated_at=now,
            )
            db.add(contributor)
            db.flush()
        else:
            # Update name/email if provided and contributor was matched by phone
            if contributor.name != name:
                contributor.name = name
            if body.get("email"):
                contributor.email = (body.get("email") or "").strip() or contributor.email
            contributor.updated_at = now

    # Check if already linked
    existing = db.query(EventContributor).filter(
        EventContributor.event_id == eid,
        EventContributor.contributor_id == contributor.id,
    ).first()
    if existing:
        return standard_response(False, "This contributor is already added to this event")

    ec = EventContributor(
        id=uuid.uuid4(),
        event_id=eid,
        contributor_id=contributor.id,
        pledge_amount=body.get("pledge_amount", 0),
        notes=(body.get("notes") or "").strip() or None,
        created_at=now,
        updated_at=now,
    )
    db.add(ec)
    db.commit()

    # Reload with relationships
    ec = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.id == ec.id).first()

    # Send SMS when contributor is added with a pledge amount
    pledge_val = float(body.get("pledge_amount", 0))
    if pledge_val > 0 and contributor.phone:
        try:
            from utils.sms import sms_contribution_target_set
            currency = _currency_code(db, event)
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None
            sms_contribution_target_set(
                contributor.phone, contributor.name,
                event.name, pledge_val, 0, currency,
                organizer_phone=organizer_phone
            )
        except Exception:
            pass

    return standard_response(True, "Contributor added to event", _event_contributor_dict(ec))


@router.put("/events/{event_id}/contributors/{ec_id}")
def update_event_contributor(event_id: str, ec_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        ecid = uuid.UUID(ec_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    event, is_creator, cm, perms = _get_event_access(db, eid, current_user)
    if not event or (not is_creator and not cm):
        return standard_response(False, "Event not found or access denied")

    ec = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.id == ecid, EventContributor.event_id == eid).first()
    if not ec:
        return standard_response(False, "Event contributor not found")

    old_pledge = float(ec.pledge_amount or 0)
    if "pledge_amount" in body:
        ec.pledge_amount = body["pledge_amount"]
    if "notes" in body:
        ec.notes = (body["notes"] or "").strip() or None

    ec.updated_at = datetime.now(EAT)
    db.commit()

    # Send SMS when pledge target is set/changed (use contributor.phone directly)
    new_pledge = float(ec.pledge_amount or 0)
    if new_pledge > 0 and new_pledge != old_pledge and ec.contributor and ec.contributor.phone:
        try:
            from utils.sms import sms_contribution_target_set
            total_paid = sum(float(c.amount or 0) for c in ec.contributions)
            currency = _currency_code(db, event)
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None
            sms_contribution_target_set(
                ec.contributor.phone, ec.contributor.name,
                event.name, new_pledge, total_paid, currency,
                organizer_phone=organizer_phone
            )
        except Exception:
            pass

    return standard_response(True, "Event contributor updated", _event_contributor_dict(ec))


@router.delete("/events/{event_id}/contributors/{ec_id}")
def remove_from_event(event_id: str, ec_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        ecid = uuid.UUID(ec_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    event, is_creator, cm_del, perms_del = _get_event_access(db, eid, current_user)
    if not event or not is_creator:
        return standard_response(False, "Only event creator can remove contributors")

    ec = db.query(EventContributor).filter(EventContributor.id == ecid, EventContributor.event_id == eid).first()
    if not ec:
        return standard_response(False, "Event contributor not found")

    db.delete(ec)
    db.commit()

    return standard_response(True, "Contributor removed from event")


# ══════════════════════════════════════════════
# PAYMENTS
# ══════════════════════════════════════════════

@router.post("/events/{event_id}/contributors/{ec_id}/payments")
def record_payment(event_id: str, ec_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        ecid = uuid.UUID(ec_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    event, is_creator, cm, perms = _get_event_access(db, eid, current_user)
    if not event:
        return standard_response(False, "Event not found")
    # Must be creator or have manage_contributions permission
    if not is_creator:
        if not cm or not perms or not perms.can_manage_contributions:
            return standard_response(False, "You do not have permission to record contributions")

    ec = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
    ).filter(EventContributor.id == ecid, EventContributor.event_id == eid).first()
    if not ec:
        return standard_response(False, "Event contributor not found")

    amount = body.get("amount")
    if not amount or float(amount) <= 0:
        return standard_response(False, "A valid payment amount is required")

    payment_method_str = body.get("payment_method")
    payment_method = None
    if payment_method_str:
        try:
            payment_method = PaymentMethodEnum(payment_method_str)
        except ValueError:
            pass

    now = datetime.now(EAT)
    # If recorded by committee member (not creator), status is pending
    confirmation_status = ContributionStatusEnum.confirmed if is_creator else ContributionStatusEnum.pending
    
    contribution = EventContribution(
        id=uuid.uuid4(),
        event_id=eid,
        event_contributor_id=ec.id,
        contributor_name=ec.contributor.name if ec.contributor else "Unknown",
        amount=float(amount),
        payment_method=payment_method,
        transaction_ref=(body.get("payment_reference") or "").strip() or None,
        recorded_by=current_user.id if not is_creator else None,
        confirmation_status=confirmation_status,
        confirmed_at=now if is_creator else None,
        contributed_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(contribution)
    db.commit()

    # Send SMS to contributor
    contributor = ec.contributor
    if contributor and contributor.phone:
        try:
            from utils.sms import sms_contribution_recorded
            total_paid = sum(float(c.amount or 0) for c in ec.contributions)
            pledge = float(ec.pledge_amount or 0)
            currency = _currency_code(db, event)
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None
            recorder_name = f"{current_user.first_name} {current_user.last_name}" if not is_creator else None
            sms_contribution_recorded(
                contributor.phone, contributor.name,
                event.name, float(amount), pledge, total_paid, currency,
                organizer_phone=organizer_phone,
                recorder_name=recorder_name,
            )
        except Exception:
            pass

    return standard_response(True, "Payment recorded", {
        "id": str(contribution.id),
        "amount": float(contribution.amount),
        "payment_method": payment_method_str,
        "payment_reference": contribution.transaction_ref,
        "confirmation_status": confirmation_status.value,
        "created_at": contribution.created_at.isoformat(),
    })


@router.post("/events/{event_id}/contributors/{ec_id}/thank-you")
def send_thank_you_sms(event_id: str, ec_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send a thank you SMS to an event contributor."""
    try:
        eid = uuid.UUID(event_id)
        ecid = uuid.UUID(ec_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    event, is_creator, cm_ty, perms_ty = _get_event_access(db, eid, current_user)
    if not event or (not is_creator and not cm_ty):
        return standard_response(False, "Event not found or access denied")

    ec = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
    ).filter(EventContributor.id == ecid, EventContributor.event_id == eid).first()
    if not ec:
        return standard_response(False, "Event contributor not found")

    contributor = ec.contributor
    if not contributor or not contributor.phone:
        return standard_response(False, "Contributor has no phone number for SMS")

    custom_message = (body.get("custom_message") or "").strip()
    try:
        from utils.sms import sms_thank_you
        organizer_phone = format_phone_display(current_user.phone) if current_user.phone else None
        sms_thank_you(contributor.phone, contributor.name, event.name, custom_message, organizer_phone=organizer_phone)
    except Exception as e:
        return standard_response(False, f"Failed to send SMS: {str(e)}")

    return standard_response(True, "Thank you sent successfully", {"sent": True})


# ══════════════════════════════════════════════
# BULK CONTRIBUTORS
# ══════════════════════════════════════════════

@router.post("/events/{event_id}/contributors/bulk")
def bulk_add_contributors(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Bulk add/update contributors to an event.
    Body: { contributors: [{ name, phone, pledge_amount? }], send_sms?: bool, mode?: "targets" | "contributions", payment_method?: str }
    - For each row: validate phone (Tanzanian), find existing contributor by phone, create if new.
    - If contributor already linked to event: update pledge/record payment. If not: link them.
    - send_sms: if false, skip all SMS notifications. Default false for bulk.
    """
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    # Bulk upload is CREATOR ONLY
    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only event creator can perform bulk uploads")

    rows = body.get("contributors", [])
    if not rows or not isinstance(rows, list):
        return standard_response(False, "No contributors provided")

    if len(rows) > 500:
        return standard_response(False, "Maximum 500 contributors per upload")

    send_sms = body.get("send_sms", False)
    mode = body.get("mode", "targets")  # "targets" or "contributions"
    payment_method_str = body.get("payment_method", "other")

    now = datetime.now(EAT)
    currency = _currency_code(db, event)
    organizer = db.query(User).filter(User.id == event.organizer_id).first()
    organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None

    results = []
    errors_list = []

    for idx, row in enumerate(rows):
        row_num = idx + 1
        name = (row.get("name") or "").strip()
        phone_raw = (row.get("phone") or "").strip()
        amount = float(row.get("amount") or 0)

        if not name:
            errors_list.append({"row": row_num, "message": "Name is required"})
            continue

        if not phone_raw:
            errors_list.append({"row": row_num, "message": f"Phone is required for {name}"})
            continue

        # Validate & format phone
        try:
            phone = validate_tanzanian_phone(phone_raw)
        except ValueError:
            errors_list.append({"row": row_num, "message": f"Invalid phone for {name}: {phone_raw}"})
            continue

        # Find existing contributor by phone ONLY in user's address book
        contributor = db.query(UserContributor).filter(
            UserContributor.user_id == current_user.id,
            UserContributor.phone == phone,
        ).first()

        if not contributor:
            # Create new contributor — does NOT remove any existing ones
            contributor = UserContributor(
                id=uuid.uuid4(),
                user_id=current_user.id,
                name=name,
                phone=phone,
                created_at=now,
                updated_at=now,
            )
            db.add(contributor)
            db.flush()
        else:
            # Update name if provided and different
            if name and contributor.name != name:
                contributor.name = name
                contributor.updated_at = now

        # Check if already linked to event
        ec = db.query(EventContributor).filter(
            EventContributor.event_id == eid,
            EventContributor.contributor_id == contributor.id,
        ).first()

        if mode == "targets":
            if ec:
                old_pledge = float(ec.pledge_amount or 0)
                ec.pledge_amount = amount
                ec.updated_at = now
                action = "updated"

                if send_sms and amount > 0 and amount != old_pledge and contributor.phone:
                    try:
                        from utils.sms import sms_contribution_target_set
                        total_paid = sum(float(c.amount or 0) for c in ec.contributions)
                        sms_contribution_target_set(
                            contributor.phone, contributor.name,
                            event.name, amount, total_paid, currency,
                            organizer_phone=organizer_phone
                        )
                    except Exception:
                        pass
            else:
                ec = EventContributor(
                    id=uuid.uuid4(),
                    event_id=eid,
                    contributor_id=contributor.id,
                    pledge_amount=amount,
                    created_at=now,
                    updated_at=now,
                )
                db.add(ec)
                db.flush()
                action = "added"

                if send_sms and amount > 0 and contributor.phone:
                    try:
                        from utils.sms import sms_contribution_target_set
                        sms_contribution_target_set(
                            contributor.phone, contributor.name,
                            event.name, amount, 0, currency,
                            organizer_phone=organizer_phone
                        )
                    except Exception:
                        pass

        else:  # mode == "contributions"
            if not ec:
                ec = EventContributor(
                    id=uuid.uuid4(),
                    event_id=eid,
                    contributor_id=contributor.id,
                    pledge_amount=0,
                    created_at=now,
                    updated_at=now,
                )
                db.add(ec)
                db.flush()

            if amount > 0:
                payment_method = None
                if payment_method_str:
                    try:
                        payment_method = PaymentMethodEnum(payment_method_str)
                    except ValueError:
                        pass

                contribution = EventContribution(
                    id=uuid.uuid4(),
                    event_id=eid,
                    event_contributor_id=ec.id,
                    contributor_name=contributor.name,
                    amount=amount,
                    payment_method=payment_method,
                    contributed_at=now,
                    created_at=now,
                    updated_at=now,
                )
                db.add(contribution)

                if send_sms and contributor.phone:
                    try:
                        from utils.sms import sms_contribution_recorded
                        total_paid_so_far = sum(float(c.amount or 0) for c in ec.contributions) + amount
                        pledge = float(ec.pledge_amount or 0)
                        sms_contribution_recorded(
                            contributor.phone, contributor.name,
                            event.name, amount, pledge, total_paid_so_far, currency,
                            organizer_phone=organizer_phone
                        )
                    except Exception:
                        pass

            action = "recorded"

        results.append({"row": row_num, "name": name, "action": action})

    db.commit()

    return standard_response(True, f"Bulk operation complete: {len(results)} processed, {len(errors_list)} errors", {
        "processed": len(results),
        "errors_count": len(errors_list),
        "results": results,
        "errors": errors_list,
    })


@router.get("/events/{event_id}/contributors/{ec_id}/payments")
def get_payment_history(event_id: str, ec_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        ecid = uuid.UUID(ec_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    event, is_creator, cm_ph, perms_ph = _get_event_access(db, eid, current_user)
    if not event or (not is_creator and not cm_ph):
        return standard_response(False, "Event not found or access denied")

    ec = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.id == ecid, EventContributor.event_id == eid).first()
    if not ec:
        return standard_response(False, "Event contributor not found")

    payments = sorted(ec.contributions, key=lambda p: p.created_at or datetime.min, reverse=True)

    return standard_response(True, "Payment history fetched", {
        "contributor": _contributor_dict(ec.contributor) if ec.contributor else None,
        "pledge_amount": float(ec.pledge_amount or 0),
        "total_paid": sum(float(p.amount or 0) for p in payments),
        "payments": [{
            "id": str(p.id),
            "amount": float(p.amount),
            "payment_method": p.payment_method.value if p.payment_method else None,
            "payment_reference": p.transaction_ref,
            "confirmation_status": p.confirmation_status.value if p.confirmation_status else "confirmed",
            "recorded_by_name": (
                f"{p.recorder.first_name} {p.recorder.last_name}" if is_creator and p.recorded_by and hasattr(p, 'recorder') and p.recorder else None
            ),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        } for p in payments],
    })


# ══════════════════════════════════════════════
# CONTRIBUTION CONFIRMATION (Creator only)
# ══════════════════════════════════════════════

@router.get("/events/{event_id}/pending-contributions")
def get_pending_contributions(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all pending contributions awaiting creator confirmation."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only event creator can view pending contributions")

    pending = db.query(EventContribution).filter(
        EventContribution.event_id == eid,
        EventContribution.confirmation_status == ContributionStatusEnum.pending,
    ).order_by(EventContribution.created_at.desc()).all()

    items = []
    for c in pending:
        ec = db.query(EventContributor).options(
            joinedload(EventContributor.contributor),
        ).filter(EventContributor.id == c.event_contributor_id).first()
        recorder = db.query(User).filter(User.id == c.recorded_by).first() if c.recorded_by else None
        items.append({
            "id": str(c.id),
            "contributor_name": ec.contributor.name if ec and ec.contributor else c.contributor_name,
            "contributor_phone": ec.contributor.phone if ec and ec.contributor else None,
            "amount": float(c.amount),
            "payment_method": c.payment_method.value if c.payment_method else None,
            "transaction_ref": c.transaction_ref,
            "recorded_by": f"{recorder.first_name} {recorder.last_name}" if recorder else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return standard_response(True, "Pending contributions fetched", {"contributions": items, "count": len(items)})


@router.get("/events/{event_id}/my-recorded-contributions")
def get_my_recorded_contributions(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get contributions recorded by the current committee member."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event, is_creator, cm, perms = _get_event_access(db, eid, current_user)
    if not event:
        return standard_response(False, "Event not found")
    if is_creator:
        return standard_response(False, "Event creator cannot use this endpoint; use pending-contributions instead")
    if not cm or not perms or not perms.can_manage_contributions:
        return standard_response(False, "You do not have permission to record contributions")

    # Get all contributions recorded by this committee member
    contributions = db.query(EventContribution).filter(
        EventContribution.event_id == eid,
        EventContribution.recorded_by == current_user.id,
    ).order_by(EventContribution.created_at.desc()).all()

    items = []
    for c in contributions:
        ec = db.query(EventContributor).options(
            joinedload(EventContributor.contributor),
        ).filter(EventContributor.id == c.event_contributor_id).first()
        items.append({
            "id": str(c.id),
            "contributor_name": ec.contributor.name if ec and ec.contributor else c.contributor_name,
            "contributor_phone": ec.contributor.phone if ec and ec.contributor else None,
            "amount": float(c.amount),
            "payment_method": c.payment_method.value if c.payment_method else None,
            "transaction_ref": c.transaction_ref,
            "confirmation_status": c.confirmation_status.value if c.confirmation_status else "confirmed",
            "confirmed_at": c.confirmed_at.isoformat() if c.confirmed_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return standard_response(True, "Your recorded contributions fetched", {"contributions": items, "count": len(items)})


@router.post("/events/{event_id}/confirm-contributions")
def confirm_contributions(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Confirm one or more pending contributions. Body: { contribution_ids: [...] }"""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only event creator can confirm contributions")

    ids = body.get("contribution_ids", [])
    if not ids:
        return standard_response(False, "No contribution IDs provided")

    now = datetime.now(EAT)
    confirmed_count = 0
    for cid_str in ids:
        try:
            cid = uuid.UUID(cid_str)
        except ValueError:
            continue
        c = db.query(EventContribution).filter(
            EventContribution.id == cid,
            EventContribution.event_id == eid,
            EventContribution.confirmation_status == ContributionStatusEnum.pending,
        ).first()
        if c:
            c.confirmation_status = ContributionStatusEnum.confirmed
            c.confirmed_at = now
            c.updated_at = now
            confirmed_count += 1

    db.commit()
    return standard_response(True, f"{confirmed_count} contributions confirmed", {"confirmed": confirmed_count})