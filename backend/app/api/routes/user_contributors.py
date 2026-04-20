# User Contributors Routes - /user-contributors/...
# Handles personal contributor address book & event contributor management

import math
import uuid
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Body, Query
from sqlalchemy import func as sa_func, or_, and_
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from models import (
    UserContributor, EventContributor, EventContribution,
    ContributionThankYouMessage,
    Event, EventImage, User, Currency,
    EventCommitteeMember, CommitteePermission,
    PaymentMethodEnum, ContributionStatusEnum,
)
from utils.auth import get_current_user
from utils.helpers import standard_response, format_phone_display
from utils.validation_functions import validate_phone_number

EAT = pytz.timezone("Africa/Nairobi")

router = APIRouter(prefix="/user-contributors", tags=["User Contributors"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _contributor_dict(c: UserContributor) -> dict:
    return {
        "id": str(c.id),
        "user_id": str(c.user_id),
        "contributor_user_id": str(c.contributor_user_id) if c.contributor_user_id else None,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _normalize_phone_digits(phone: str) -> str:
    """Return last 9 digits of a phone for cross-format matching."""
    if not phone:
        return ""
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else digits


def _find_user_by_phone(db: Session, phone: str):
    """Find a registered Nuru User whose phone matches (last-9-digit comparison)."""
    if not phone:
        return None
    target = _normalize_phone_digits(phone)
    if not target:
        return None
    from sqlalchemy import func as _f
    matches = db.query(User).filter(
        User.phone.isnot(None),
        _f.right(_f.regexp_replace(User.phone, r'[^0-9]', '', 'g'), 9) == target,
    ).limit(1).all()
    return matches[0] if matches else None


def _event_contributor_dict(ec: EventContributor, show_recorder: bool = False) -> dict:
    total_paid = sum(float(c.amount or 0) for c in ec.contributions if c.confirmation_status is None or c.confirmation_status == ContributionStatusEnum.confirmed)
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
        q = q.filter(or_(
            UserContributor.name.ilike(like),
            UserContributor.email.ilike(like),
            UserContributor.phone.ilike(like),
        ))

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


# NOTE: Static routes (e.g. /my-contributions) MUST be registered BEFORE the
# dynamic /{contributor_id} route, otherwise FastAPI captures them as a
# contributor_id and returns "Invalid contributor ID". The actual handler for
# /my-contributions lives further down in this file; we register a thin
# forwarding route here so it wins the route-matching race.
@router.get("/my-contributions")
def my_contributions_early(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return my_contributions(search=search, db=db, current_user=current_user)  # type: ignore[name-defined]


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
            phone = validate_phone_number(phone)
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

    # Auto-link to a registered Nuru user if their phone matches
    linked_user = _find_user_by_phone(db, phone) if phone else None

    c = UserContributor(
        id=uuid.uuid4(),
        user_id=current_user.id,
        contributor_user_id=linked_user.id if linked_user else None,
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
        new_name = body["name"].strip()
        if new_name != c.name:
            existing_name = db.query(UserContributor).filter(
                UserContributor.user_id == current_user.id,
                UserContributor.name == new_name,
                UserContributor.id != cid,
            ).first()
            if existing_name:
                return standard_response(False, f"A contributor named '{new_name}' already exists")
        c.name = new_name
    if "email" in body:
        c.email = (body["email"] or "").strip() or None
    if "phone" in body:
        phone_val = (body["phone"] or "").strip() or None
        if phone_val:
            try:
                phone_val = validate_phone_number(phone_val)
            except ValueError as e:
                return standard_response(False, str(e))
            if phone_val != c.phone:
                existing_phone = db.query(UserContributor).filter(
                    UserContributor.user_id == current_user.id,
                    UserContributor.phone == phone_val,
                    UserContributor.id != cid,
                ).first()
                if existing_phone:
                    return standard_response(False, f"Phone number {format_phone_display(phone_val)} is already used by contributor '{existing_phone.name}'")
        c.phone = phone_val
        # Re-link to a registered Nuru user when phone changes
        linked_user = _find_user_by_phone(db, phone_val) if phone_val else None
        c.contributor_user_id = linked_user.id if linked_user else None
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

    # SAFETY: Check if this contributor has any recorded payments across any events.
    # Deleting the UserContributor would CASCADE-delete EventContributors and their
    # EventContributions, causing permanent data loss.
    linked_ecs = db.query(EventContributor).filter(EventContributor.contributor_id == cid).all()
    for ec in linked_ecs:
        payment_count = db.query(EventContribution).filter(
            EventContribution.event_contributor_id == ec.id
        ).count()
        if payment_count > 0:
            event = db.query(Event).filter(Event.id == ec.event_id).first()
            event_name = event.name if event else "an event"
            return standard_response(
                False,
                f"Cannot delete '{c.name}' because they have {payment_count} recorded contribution(s) in '{event_name}'. "
                f"Remove their contributions first, or remove them from the event."
            )

    # Safe to delete — no contributions exist, cascade will only remove empty event links
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
    limit: int = Query(50, ge=1, le=1000),
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

    # Build base query WITHOUT joinedload (to avoid row inflation from one-to-many JOINs)
    base_q = db.query(EventContributor).filter(EventContributor.event_id == eid)

    if search:
        like = f"%{search}%"
        base_q = base_q.join(UserContributor).filter(or_(
            UserContributor.name.ilike(like),
            UserContributor.email.ilike(like),
            UserContributor.phone.ilike(like),
        ))

    total = base_q.count()

    # Paginate on IDs FIRST — use (created_at DESC, id DESC) for stable ordering
    # Without the id tiebreaker, records with identical timestamps shift between pages
    id_rows = base_q.with_entities(EventContributor.id).order_by(
        EventContributor.created_at.desc(),
        EventContributor.id.desc(),
    ).offset((page - 1) * limit).limit(limit).all()
    ec_ids = [r[0] for r in id_rows]

    # Now load full objects with relationships for just those IDs
    if ec_ids:
        ecs = db.query(EventContributor).options(
            joinedload(EventContributor.contributor),
            joinedload(EventContributor.contributions),
        ).filter(EventContributor.id.in_(ec_ids)).all()
        # Deduplicate (joinedload may still produce duplicate parent rows)
        seen = set()
        unique_ecs = []
        for ec in ecs:
            if ec.id not in seen:
                seen.add(ec.id)
                unique_ecs.append(ec)
        # Restore original ordering (created_at desc, id desc)
        id_order = {eid: idx for idx, eid in enumerate(ec_ids)}
        ecs = sorted(unique_ecs, key=lambda ec: id_order.get(ec.id, 0))
    else:
        ecs = []

    ec_dicts = [_event_contributor_dict(ec) for ec in ecs]

    # Compute summary from ALL event contributors (not just current page)
    all_ecs_for_summary = db.query(EventContributor).options(
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.event_id == eid).all()
    # Deduplicate
    seen_summary = set()
    unique_summary_ecs = []
    for ec in all_ecs_for_summary:
        if ec.id not in seen_summary:
            seen_summary.add(ec.id)
            unique_summary_ecs.append(ec)
    all_dicts = [_event_contributor_dict(ec) for ec in unique_summary_ecs]
    total_pledged = sum(d["pledge_amount"] for d in all_dicts)
    total_paid = sum(d["total_paid"] for d in all_dicts)
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
                inline_phone = validate_phone_number(inline_phone)
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

    # Auto-add this contributor to the event group workspace if one exists
    try:
        from api.routes.event_groups import ensure_member_for_contributor
        ensure_member_for_contributor(db, eid, contributor)
        db.commit()
    except Exception:
        db.rollback()

    # Send WhatsApp (primary) + SMS (fallback) when contributor is added with a pledge amount
    pledge_val = float(body.get("pledge_amount", 0))
    if pledge_val > 0 and contributor.phone:
        try:
            from utils.whatsapp import wa_contribution_target_set
            currency = _currency_code(db, event)
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None
            wa_contribution_target_set(
                contributor.phone, contributor.name,
                event.name, pledge_val, 0, currency,
                organizer_phone=organizer_phone
            )
        except Exception:
            pass
        # SMS fallback
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

    # Send WhatsApp (primary) + SMS (fallback) when pledge target is changed
    new_pledge = float(ec.pledge_amount or 0)
    if new_pledge > 0 and new_pledge != old_pledge and ec.contributor and ec.contributor.phone:
        try:
            from utils.whatsapp import wa_contribution_target_set
            total_paid = sum(float(c.amount or 0) for c in ec.contributions)
            currency = _currency_code(db, event)
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None
            wa_contribution_target_set(
                ec.contributor.phone, ec.contributor.name,
                event.name, new_pledge, total_paid, currency,
                organizer_phone=organizer_phone
            )
        except Exception:
            pass
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

    # Manually cascade: delete thank-you messages → contributions → event contributor
    contribution_ids = [c.id for c in db.query(EventContribution.id).filter(EventContribution.event_contributor_id == ecid).all()]
    if contribution_ids:
        db.query(ContributionThankYouMessage).filter(
            ContributionThankYouMessage.contribution_id.in_(contribution_ids)
        ).delete(synchronize_session=False)
        db.query(EventContribution).filter(
            EventContribution.event_contributor_id == ecid
        ).delete(synchronize_session=False)

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

    # Post into event group workspace (if one exists). Best-effort.
    try:
        from api.routes.event_groups import post_payment_system_message
        total_paid_after = sum(float(c.amount or 0) for c in ec.contributions)
        pledge_amount = float(ec.pledge_amount or 0)
        currency = _currency_code(db, event)
        post_payment_system_message(
            db, eid,
            ec.contributor.name if ec.contributor else "Someone",
            float(amount), pledge_amount, total_paid_after, currency,
        )
    except Exception:
        pass

    # Send WhatsApp (primary) + SMS (fallback) to contributor
    contributor = ec.contributor
    if contributor and contributor.phone:
        try:
            from utils.whatsapp import wa_contribution_recorded
            total_paid = sum(float(c.amount or 0) for c in ec.contributions)
            pledge = float(ec.pledge_amount or 0)
            currency = _currency_code(db, event)
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            organizer_phone = format_phone_display(organizer.phone) if organizer and organizer.phone else None
            recorder_name = f"{current_user.first_name} {current_user.last_name}" if not is_creator else None
            wa_contribution_recorded(
                contributor.phone, contributor.name,
                event.name, float(amount), pledge, total_paid, currency,
                organizer_phone=organizer_phone,
                recorder_name=recorder_name,
            )
        except Exception:
            pass
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
        return standard_response(False, "Contributor has no phone number")

    custom_message = (body.get("custom_message") or "").strip()
    organizer_phone = format_phone_display(current_user.phone) if current_user.phone else None

    # WhatsApp first
    try:
        from utils.whatsapp import wa_thank_you
        wa_thank_you(contributor.phone, contributor.name, event.name, custom_message, organizer_phone=organizer_phone)
    except Exception:
        pass

    # SMS fallback
    try:
        from utils.sms import sms_thank_you
        sms_thank_you(contributor.phone, contributor.name, event.name, custom_message, organizer_phone=organizer_phone)
    except Exception as e:
        return standard_response(False, f"We couldn't send the message. Please try again.")

    return standard_response(True, "Thank you sent", {"sent": True})


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
            phone = validate_phone_number(phone_raw)
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
                    confirmation_status=ContributionStatusEnum.confirmed,
                    confirmed_at=now,
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

    from utils.batch_loaders import build_pending_contribution_dicts
    items = build_pending_contribution_dicts(db, pending, include_status=False)

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

    from utils.batch_loaders import build_pending_contribution_dicts
    items = build_pending_contribution_dicts(db, contributions, include_status=True)

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
    currency = _currency_code(db, event)
    confirmed_count = 0
    notify_targets = []  # collect (phone, msg) tuples for after-commit dispatch

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

            # Build approval notification to the contributor
            ec = db.query(EventContributor).options(
                joinedload(EventContributor.contributor),
            ).filter(EventContributor.id == c.event_contributor_id).first()
            if ec and ec.contributor and ec.contributor.phone:
                msg = (
                    f"Hello {ec.contributor.name}, your contribution of "
                    f"{currency} {float(c.amount):,.0f} for {event.name} has been "
                    f"confirmed by the event organiser. Thank you!"
                )
                notify_targets.append((ec.contributor.phone, msg))

    db.commit()

    # Fire WhatsApp + SMS-fallback notifications (best-effort, post-commit)
    try:
        from utils.notify_channels import notify_user_wa_sms
        for phone, msg in notify_targets:
            try:
                notify_user_wa_sms(phone, msg)
            except Exception as e:
                print(f"[confirm-contributions] notify failed: {e}")
    except Exception:
        pass

    return standard_response(True, f"{confirmed_count} contributions confirmed", {"confirmed": confirmed_count})


# ══════════════════════════════════════════════
# REJECT PENDING CONTRIBUTIONS (Creator only)
# ══════════════════════════════════════════════

@router.post("/events/{event_id}/reject-contributions")
def reject_contributions(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reject one or more pending contributions. Deletes the record and notifies the contributor."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only event creator can reject contributions")

    ids = body.get("contribution_ids", [])
    if not ids:
        return standard_response(False, "No contribution IDs provided")

    currency = _currency_code(db, event)
    rejected_count = 0
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
            # Get contributor info for SMS
            ec = db.query(EventContributor).options(
                joinedload(EventContributor.contributor),
            ).filter(EventContributor.id == c.event_contributor_id).first()
            recorder = db.query(User).filter(User.id == c.recorded_by).first() if c.recorded_by else None
            recorder_name = f"{recorder.first_name} {recorder.last_name}" if recorder else "a committee member"

            # Send rejection notification to contributor (WhatsApp + SMS fallback)
            if ec and ec.contributor and ec.contributor.phone:
                try:
                    from utils.notify_channels import notify_user_wa_sms
                    msg = (
                        f"Hello {ec.contributor.name}, "
                        f"a contribution record of {currency} {float(c.amount):,.0f} for {event.name} "
                        f"recorded by {recorder_name} could not be verified by the event organizer "
                        f"and has been removed. "
                        f"If you believe this is an error, please contact the organizer directly."
                    )
                    notify_user_wa_sms(ec.contributor.phone, msg)
                except Exception:
                    pass

            # Delete associated thank you message if any
            db.query(ContributionThankYouMessage).filter(
                ContributionThankYouMessage.contribution_id == cid
            ).delete()
            db.delete(c)
            rejected_count += 1

    db.commit()
    return standard_response(True, f"{rejected_count} contributions rejected and removed", {"rejected": rejected_count})


# ══════════════════════════════════════════════
# DELETE A SPECIFIC CONTRIBUTION/TRANSACTION
# ══════════════════════════════════════════════

@router.delete("/events/{event_id}/contributors/{ec_id}/payments/{payment_id}")
def delete_contribution(event_id: str, ec_id: str, payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a specific payment/transaction record. Creator only."""
    try:
        eid = uuid.UUID(event_id)
        ecid = uuid.UUID(ec_id)
        pid = uuid.UUID(payment_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only event creator can delete transactions")

    contribution = db.query(EventContribution).filter(
        EventContribution.id == pid,
        EventContribution.event_id == eid,
        EventContribution.event_contributor_id == ecid,
    ).first()
    if not contribution:
        return standard_response(False, "Transaction not found")

    # Delete associated thank you message
    db.query(ContributionThankYouMessage).filter(
        ContributionThankYouMessage.contribution_id == pid
    ).delete()
    db.delete(contribution)
    db.commit()

    return standard_response(True, "Transaction deleted successfully")


# ══════════════════════════════════════════════
# CONTRIBUTION REPORT (date-filtered)
# ══════════════════════════════════════════════

@router.get("/events/{event_id}/contribution-report")
def get_contribution_report(
    event_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns contributor payment totals filtered by date range.
    Only payments (EventContribution) within the date range are summed.
    Pledges are shown as-is (not date-filtered) for context, but the
    report header warns that balances may be partial.
    """
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event, is_creator, cm, perms = _get_event_access(db, eid, current_user)
    if not event:
        return standard_response(False, "Event not found")
    if not is_creator and not cm:
        return standard_response(False, "Access denied")

    # Parse dates
    from_dt = None
    to_dt = None
    if date_from:
        try:
            from_dt = datetime.strptime(date_from, "%Y-%m-%d").replace(hour=0, minute=0, second=0, tzinfo=EAT)
        except ValueError:
            return standard_response(False, "Invalid date_from format, use YYYY-MM-DD")
    if date_to:
        try:
            to_dt = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=EAT)
        except ValueError:
            return standard_response(False, "Invalid date_to format, use YYYY-MM-DD")

    # Get all event contributors (deduplicate joinedload inflation)
    raw_ecs = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.event_id == eid).all()
    seen_ids = set()
    ecs = []
    for ec in raw_ecs:
        if ec.id not in seen_ids:
            seen_ids.add(ec.id)
            ecs.append(ec)

    currency = _currency_code(db, event)
    results = []
    # Full (all-time) totals for summary cards
    full_total_pledged = 0
    full_total_paid = 0

    for ec in ecs:
        pledge = float(ec.pledge_amount or 0)
        # All confirmed payments (for full summary)
        all_confirmed = [
            c for c in ec.contributions
            if (not hasattr(c, 'confirmation_status') or c.confirmation_status is None or c.confirmation_status == ContributionStatusEnum.confirmed)
        ]
        all_paid = sum(float(c.amount or 0) for c in all_confirmed)
        full_total_pledged += pledge
        full_total_paid += all_paid

        # Filter payments by date range (for table rows)
        if from_dt or to_dt:
            def _make_aware(dt):
                """Ensure datetime is timezone-aware for comparison."""
                if dt is None:
                    return None
                if dt.tzinfo is None:
                    return EAT.localize(dt)
                return dt

            filtered_payments = [
                c for c in all_confirmed
                if (not from_dt or (c.contributed_at and _make_aware(c.contributed_at) >= from_dt))
                and (not to_dt or (c.contributed_at and _make_aware(c.contributed_at) <= to_dt))
            ]
            paid_in_range = sum(float(c.amount or 0) for c in filtered_payments)
        else:
            paid_in_range = all_paid

        # When date-filtered, only include contributors with payments in range
        if from_dt or to_dt:
            if paid_in_range > 0:
                results.append({
                    "name": ec.contributor.name if ec.contributor else "Unknown",
                    "phone": ec.contributor.phone if ec.contributor else None,
                    "pledged": pledge,
                    "paid": paid_in_range,
                    "balance": max(0, pledge - paid_in_range),
                })
        else:
            # Include ALL event contributors in unfiltered reports — even
            # those with no pledge/target and no payments yet. Owners want
            # the full roster on the PDF, not just active payers.
            results.append({
                "name": ec.contributor.name if ec.contributor else "Unknown",
                "phone": ec.contributor.phone if ec.contributor else None,
                "pledged": pledge,
                "paid": paid_in_range,
                "balance": max(0, pledge - paid_in_range),
            })

    # Sort alphabetically
    results.sort(key=lambda r: r["name"])

    table_total_paid = sum(r["paid"] for r in results)

    return standard_response(True, "Report data fetched", {
        "contributors": results,
        "full_summary": {
            "total_pledged": full_total_pledged,
            "total_paid": full_total_paid,
            "total_balance": max(0, full_total_pledged - full_total_paid),
            "count": len(ecs),
            "currency": currency,
        },
        "filtered_summary": {
            "total_paid": table_total_paid,
            "contributor_count": len(results),
        },
        "date_from": date_from,
        "date_to": date_to,
        "is_filtered": bool(date_from or date_to),
    })


# ──────────────────────────────────────────────
# Bulk Messaging by Contribution Status
# ──────────────────────────────────────────────

@router.post("/events/{event_id}/bulk-message")
def send_bulk_contributor_message(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Send bulk SMS to contributors filtered by contribution status.
    Body: {
        case_type: "no_contribution" | "partial" | "completed",
        message_template: str,
        payment_info?: str,
        contributor_ids: [ec_id, ...]
    }
    Template variables: {name}, {event_name}, {event_title}, {payment}
    """
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    # Permission: must be event creator or committee member with contribution permissions
    is_creator = str(event.organizer_id) == str(current_user.id)
    if not is_creator:
        member = db.query(EventCommitteeMember).filter(
            EventCommitteeMember.event_id == eid,
            EventCommitteeMember.user_id == current_user.id,
            EventCommitteeMember.status == "active"
        ).first()
        if not member:
            return standard_response(False, "Not authorized", status_code=403)

    case_type = body.get("case_type", "")
    message_template = (body.get("message_template") or "").strip()
    payment_info = (body.get("payment_info") or "").strip()
    contributor_ids = body.get("contributor_ids", [])

    if not message_template:
        return standard_response(False, "Message template is required")
    if not contributor_ids:
        return standard_response(False, "No contributors selected")
    if len(contributor_ids) > 1000:
        return standard_response(False, "Maximum 1000 recipients per batch")

    # Fetch event contributors with their contributor details
    ec_uuids = []
    for cid in contributor_ids:
        try:
            ec_uuids.append(uuid.UUID(cid))
        except ValueError:
            continue

    ecs = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions)
    ).filter(
        EventContributor.event_id == eid,
        EventContributor.id.in_(ec_uuids)
    ).all()

    sent = 0
    failed = 0
    errors = []

    from utils.sms import _send, SMS_SIGNATURE

    for ec in ecs:
        contributor = ec.contributor
        if not contributor or not contributor.phone:
            failed += 1
            errors.append(f"{contributor.name if contributor else 'Unknown'}: No phone number")
            continue

        # Resolve template
        name = contributor.name or "Contributor"
        resolved = message_template
        resolved = resolved.replace("{name}", name)
        resolved = resolved.replace("{event_name}", event.name or "")
        resolved = resolved.replace("{event_title}", (event.name or "").upper())

        if "{payment}" in resolved:
            if payment_info:
                resolved = resolved.replace("{payment}", payment_info)
            else:
                # Remove the entire line containing {payment}
                lines = resolved.split("\n")
                resolved = "\n".join(line for line in lines if "{payment}" not in line)

        # Resolve contact phone for the inquiry footer:
        #   1. Per-send override from body.contact_phone (highest priority)
        #   2. Per-event default event.reminder_contact_phone
        #   3. Event organiser's phone (legacy fallback)
        override_phone = (body.get("contact_phone") or "").strip() or None
        contact_phone_raw = override_phone or event.reminder_contact_phone or None
        if not contact_phone_raw:
            organizer = db.query(User).filter(User.id == event.organizer_id).first()
            contact_phone_raw = organizer.phone if organizer and organizer.phone else None
        contact_phone_display = format_phone_display(contact_phone_raw) if contact_phone_raw else None
        if contact_phone_display:
            resolved += f"\nKwa maulizo, wasiliana nasi kupitia: {contact_phone_display}\nAsante."

        resolved = resolved.strip()

        try:
            _send(contributor.phone, resolved)
            sent += 1
        except Exception as e:
            failed += 1
            errors.append(f"{name}: {str(e)}")

    return standard_response(True, f"Sent {sent}, Failed {failed}", {
        "sent": sent,
        "failed": failed,
        "errors": errors[:20],  # Limit error details
    })

# ══════════════════════════════════════════════════════════════════════════════
# MY CONTRIBUTIONS — events where the logged-in user is listed as a contributor
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/my-contributions")
def my_contributions(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all events where the logged-in user is recorded as a contributor
    (matched via UserContributor.contributor_user_id OR phone-equivalence
    backfill), with pledge / paid / balance / pending totals per event.
    """
    # 1. Find every user_contributors row that points to the current user.
    #    We match on contributor_user_id (preferred) AND on phone equivalence
    #    (covers legacy rows where the FK wasn't set yet).
    me_phone_digits = _normalize_phone_digits(current_user.phone) if getattr(current_user, "phone", None) else ""

    q = db.query(UserContributor).filter(UserContributor.contributor_user_id == current_user.id)
    contributors = q.all()

    if me_phone_digits:
        from sqlalchemy import func as _f
        legacy = db.query(UserContributor).filter(
            UserContributor.contributor_user_id.is_(None),
            UserContributor.phone.isnot(None),
            _f.right(_f.regexp_replace(UserContributor.phone, r'[^0-9]', '', 'g'), 9) == me_phone_digits,
        ).all()
        # Opportunistically backfill the FK so future queries are fast.
        if legacy:
            for c in legacy:
                c.contributor_user_id = current_user.id
            try:
                db.commit()
            except Exception:
                db.rollback()
        contributors.extend(legacy)

    if not contributors:
        return standard_response(True, "No contributions found", {"events": [], "count": 0})

    contributor_ids = [c.id for c in contributors]

    # 2. Fetch every EventContributor row for those contributors, joined with
    #    the event and contributions.
    ecs = db.query(EventContributor).options(
        joinedload(EventContributor.event),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.contributor_id.in_(contributor_ids)).all()

    results = []
    for ec in ecs:
        event = ec.event
        if not event:
            continue
        currency = _currency_code(db, event)
        pledge = float(ec.pledge_amount or 0)
        paid = sum(
            float(c.amount or 0)
            for c in ec.contributions
            if c.confirmation_status is None or c.confirmation_status == ContributionStatusEnum.confirmed
        )
        pending = sum(
            float(c.amount or 0)
            for c in ec.contributions
            if c.confirmation_status == ContributionStatusEnum.pending
        )
        organizer = db.query(User).filter(User.id == event.organizer_id).first()

        cover = event.cover_image_url
        if not cover:
            featured = (
                db.query(EventImage)
                .filter(EventImage.event_id == event.id)
                .order_by(EventImage.is_featured.desc(), EventImage.created_at.asc())
                .first()
            )
            if featured:
                cover = featured.image_url

        results.append({
            "event_id": str(event.id),
            "event_name": event.name,
            "event_cover_image_url": cover,
            "event_start_date": event.start_date.isoformat() if event.start_date else None,
            "event_location": event.location,
            "organizer_name": f"{organizer.first_name} {organizer.last_name}".strip() if organizer else None,
            "event_contributor_id": str(ec.id),
            "currency": currency,
            "pledge_amount": pledge,
            "total_paid": paid,
            "pending_amount": pending,
            "balance": max(0, pledge - paid - pending),
            "last_payment_at": max(
                (c.contributed_at for c in ec.contributions if c.contributed_at),
                default=None,
            ).isoformat() if any(c.contributed_at for c in ec.contributions) else None,
        })

    # Sort by upcoming event date asc, then by name
    results.sort(key=lambda r: (r["event_start_date"] or "9999", r["event_name"] or ""))

    if search:
        term = search.strip().lower()
        results = [
            r for r in results
            if term in (r.get("event_name") or "").lower()
            or term in (r.get("event_location") or "").lower()
            or term in (r.get("organizer_name") or "").lower()
        ]

    return standard_response(True, "My contributions fetched", {
        "events": results,
        "count": len(results),
    })


@router.post("/events/{event_id}/self-contribute")
def self_contribute(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    A logged-in contributor records a pending payment for an event they are
    listed in. Body: { amount: number, payment_reference?: string, note?: string }
    The contribution is created with status=pending and the event organiser is
    notified (in-app + push) so they can approve or reject it.
    """
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    try:
        amount = float(body.get("amount") or 0)
    except (TypeError, ValueError):
        return standard_response(False, "Invalid amount")
    if amount <= 0:
        return standard_response(False, "Amount must be greater than zero")

    payment_reference = (body.get("payment_reference") or "").strip() or None
    note = (body.get("note") or "").strip() or None

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    # Find the EventContributor row for this user on this event.
    me_phone_digits = _normalize_phone_digits(current_user.phone) if getattr(current_user, "phone", None) else ""

    # Match via contributor_user_id, or phone equivalence as a safety net.
    contributor_q = db.query(UserContributor).filter(
        UserContributor.contributor_user_id == current_user.id,
    )
    candidates = {str(c.id): c for c in contributor_q.all()}

    if me_phone_digits:
        from sqlalchemy import func as _f
        more = db.query(UserContributor).filter(
            UserContributor.phone.isnot(None),
            _f.right(_f.regexp_replace(UserContributor.phone, r'[^0-9]', '', 'g'), 9) == me_phone_digits,
        ).all()
        for c in more:
            candidates[str(c.id)] = c

    if not candidates:
        return standard_response(False, "You are not listed as a contributor for any event", status_code=403)

    contributor_uuids = [c.id for c in candidates.values()]

    ec = db.query(EventContributor).filter(
        EventContributor.event_id == eid,
        EventContributor.contributor_id.in_(contributor_uuids),
    ).first()
    if not ec:
        return standard_response(False, "You are not listed as a contributor for this event", status_code=403)

    contributor = ec.contributor

    # Build contact JSON from the user account (since they are paying themselves)
    contact = {}
    if getattr(current_user, "phone", None):
        contact["phone"] = current_user.phone
    if getattr(current_user, "email", None):
        contact["email"] = current_user.email

    contributor_name = contributor.name if contributor else f"{current_user.first_name} {current_user.last_name}".strip()
    full_note = note
    if payment_reference:
        full_note = (f"Ref: {payment_reference}" + (f" | {note}" if note else "")).strip()

    contribution = EventContribution(
        id=uuid.uuid4(),
        event_id=eid,
        event_contributor_id=ec.id,
        contributor_name=contributor_name,
        contributor_contact=contact or None,
        amount=amount,
        payment_method=None,  # TODO Phase 2: link real payment methods
        transaction_ref=payment_reference,
        recorded_by=current_user.id,
        confirmation_status=ContributionStatusEnum.pending,
        contributed_at=datetime.now(EAT),
    )
    db.add(contribution)
    db.commit()
    db.refresh(contribution)

    # Notify the event organiser (in-app)
    try:
        from utils.notify import notify_contribution_pending
        currency = _currency_code(db, event)
        notify_contribution_pending(
            db,
            recipient_id=event.organizer_id,
            sender_id=current_user.id,
            event_id=str(eid),
            event_title=event.name,
            contributor_name=contributor_name,
            amount=amount,
            currency=currency,
        )
        db.commit()
    except Exception as e:
        print(f"[self-contribute] in-app notify failed: {e}")

    # WhatsApp + SMS to organiser
    try:
        organizer = db.query(User).filter(User.id == event.organizer_id).first()
        if organizer and organizer.phone:
            from utils.notify_channels import notify_user_wa_sms
            currency = _currency_code(db, event)
            org_msg = (
                f"Hello {organizer.first_name}, {contributor_name} just submitted a "
                f"contribution of {currency} {amount:,.0f} for {event.name}. "
                f"Open Nuru to confirm or reject this entry."
            )
            notify_user_wa_sms(organizer.phone, org_msg)
    except Exception as e:
        print(f"[self-contribute] organiser notify failed: {e}")

    return standard_response(True, "Contribution submitted for approval", {
        "contribution_id": str(contribution.id),
        "amount": amount,
        "status": "pending",
    })
