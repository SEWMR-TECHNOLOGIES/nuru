# Event Expenses Routes - /user-events/{event_id}/expenses/...
# Handles expense tracking for events with permission-based access

import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    Event, EventExpense, EventCommitteeMember, CommitteePermission,
    User, UserProfile, Currency,
)
from utils.auth import get_current_user
from utils.helpers import standard_response, format_price
from utils.notify import create_notification
from utils.sms import _send as sms_send
from utils.whatsapp import _send_whatsapp

router = APIRouter(prefix="/user-events", tags=["Event Expenses"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _currency_code(db: Session, currency_id) -> str:
    if not currency_id:
        return "TZS"
    cur = db.query(Currency).filter(Currency.id == currency_id).first()
    return cur.code.strip() if cur else "TZS"


def _check_expense_access(db: Session, event_id: str, current_user, require_manage: bool = False):
    """Check expense access. Returns (event, error_response)."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return None, standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return None, standard_response(False, "Event not found")

    is_creator = str(event.organizer_id) == str(current_user.id)
    if is_creator:
        return event, None

    cm = db.query(EventCommitteeMember).filter(
        EventCommitteeMember.event_id == eid,
        EventCommitteeMember.user_id == current_user.id,
    ).first()
    if not cm:
        return None, standard_response(False, "You do not have permission to access this event")

    perms = db.query(CommitteePermission).filter(
        CommitteePermission.committee_member_id == cm.id
    ).first()

    if require_manage:
        if not perms or not perms.can_manage_expenses:
            return None, standard_response(False, "You do not have permission to manage expenses")
    else:
        if not perms or not (perms.can_view_expenses or perms.can_manage_expenses):
            return None, standard_response(False, "You do not have permission to view expenses")

    return event, None


def _expense_to_dict(expense: EventExpense, db: Session) -> dict:
    recorder_name = None
    if expense.recorded_by:
        recorder = db.query(User).filter(User.id == expense.recorded_by).first()
        if recorder:
            recorder_name = f"{recorder.first_name} {recorder.last_name}"

    return {
        "id": str(expense.id),
        "event_id": str(expense.event_id),
        "category": expense.category,
        "description": expense.description,
        "amount": float(expense.amount) if expense.amount else 0,
        "payment_method": expense.payment_method,
        "payment_reference": expense.payment_reference,
        "vendor_name": expense.vendor_name,
        "receipt_url": expense.receipt_url,
        "expense_date": expense.expense_date.isoformat() if expense.expense_date else None,
        "notes": expense.notes,
        "recorded_by_id": str(expense.recorded_by) if expense.recorded_by else None,
        "recorded_by_name": recorder_name,
        "created_at": expense.created_at.isoformat() if expense.created_at else None,
        "updated_at": expense.updated_at.isoformat() if expense.updated_at else None,
    }


def _expense_summary(db: Session, event_id, currency: str = "TZS") -> dict:
    expenses = db.query(EventExpense).filter(EventExpense.event_id == event_id).all()

    total = sum(float(e.amount) for e in expenses if e.amount)
    count = len(expenses)

    # Category breakdown
    cat_map = {}
    for e in expenses:
        cat = e.category or "Other"
        if cat not in cat_map:
            cat_map[cat] = {"category": cat, "total": 0, "count": 0}
        cat_map[cat]["total"] += float(e.amount) if e.amount else 0
        cat_map[cat]["count"] += 1

    return {
        "total_expenses": total,
        "count": count,
        "currency": currency,
        "category_breakdown": sorted(cat_map.values(), key=lambda c: c["total"], reverse=True),
    }


# ──────────────────────────────────────────────
# GET /user-events/{event_id}/expenses
# ──────────────────────────────────────────────
@router.get("/{event_id}/expenses")
def get_expenses(
    event_id: str,
    page: int = 1,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all expenses for an event with summary."""
    event, err = _check_expense_access(db, event_id, current_user, require_manage=False)
    if err:
        return err

    eid = uuid.UUID(event_id)
    currency = _currency_code(db, event.currency_id)

    query = db.query(EventExpense).filter(EventExpense.event_id == eid)

    if category:
        query = query.filter(EventExpense.category == category)
    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        query = query.filter(or_(
            EventExpense.description.ilike(search_term),
            EventExpense.vendor_name.ilike(search_term),
            EventExpense.category.ilike(search_term),
        ))

    query = query.order_by(EventExpense.expense_date.desc(), EventExpense.id.desc())

    total = query.count()
    total_pages = max(1, math.ceil(total / limit))
    expenses = query.offset((page - 1) * limit).limit(limit).all()

    summary = _expense_summary(db, eid, currency)

    return standard_response(True, "Expenses retrieved", {
        "expenses": [_expense_to_dict(e, db) for e in expenses],
        "summary": summary,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": total_pages, "has_next": page < total_pages,
            "has_previous": page > 1,
        },
    })


# ──────────────────────────────────────────────
# POST /user-events/{event_id}/expenses
# ──────────────────────────────────────────────
class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: float
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    vendor_name: Optional[str] = None
    expense_date: Optional[str] = None
    notes: Optional[str] = None
    notify_committee: Optional[bool] = False


@router.post("/{event_id}/expenses")
def add_expense(
    event_id: str,
    body: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a new expense. Requires can_manage_expenses or creator."""
    event, err = _check_expense_access(db, event_id, current_user, require_manage=True)
    if err:
        return err

    eid = uuid.UUID(event_id)

    # Parse expense date
    exp_date = None
    if body.expense_date:
        try:
            exp_date = datetime.strptime(body.expense_date, "%Y-%m-%d")
        except ValueError:
            exp_date = datetime.now()
    else:
        exp_date = datetime.now()

    expense = EventExpense(
        id=uuid.uuid4(),
        event_id=eid,
        recorded_by=current_user.id,
        category=body.category,
        description=body.description,
        amount=body.amount,
        payment_method=body.payment_method,
        payment_reference=body.payment_reference,
        vendor_name=body.vendor_name,
        expense_date=exp_date,
        notes=body.notes,
    )
    db.add(expense)

    # Notify committee members with expense permissions
    if body.notify_committee:
        recorder_name = f"{current_user.first_name} {current_user.last_name}"
        currency = _currency_code(db, event.currency_id)
        amount_str = f"{currency} {body.amount:,.0f}"

        # Find all committee members with can_manage_expenses
        members = db.query(EventCommitteeMember).filter(
            EventCommitteeMember.event_id == eid,
        ).all()

        def _send_expense_sms_wa(user_id):
            """Send SMS + WhatsApp for an expense notification."""
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.phone:
                return
            msg = (
                f"Hello {user.first_name}, {recorder_name} recorded an expense of "
                f"{amount_str} for {body.category} — {event.name}. "
                f"Open Nuru app for details."
            )
            sms_send(user.phone, msg)
            _send_whatsapp("expense_recorded", user.phone, {
                "recipient_name": user.first_name,
                "recorder_name": recorder_name,
                "amount": amount_str,
                "category": body.category,
                "event_name": event.name,
            })

        for member in members:
            if str(member.user_id) == str(current_user.id):
                continue  # Don't notify yourself
            if not member.user_id:
                continue
            perm = db.query(CommitteePermission).filter(
                CommitteePermission.committee_member_id == member.id
            ).first()
            if perm and (perm.can_manage_expenses or perm.can_view_expenses):
                create_notification(
                    db, member.user_id, current_user.id,
                    "expense_recorded",
                    f"recorded an expense of {amount_str} for {body.category} — {event.name}",
                    reference_id=eid,
                    reference_type="event",
                    message_data={
                        "event_title": event.name,
                        "amount": body.amount,
                        "category": body.category,
                        "currency": currency,
                        "recorder_name": recorder_name,
                    },
                )
                _send_expense_sms_wa(member.user_id)

        # Also notify event creator if not the recorder
        if str(event.organizer_id) != str(current_user.id):
            create_notification(
                db, event.organizer_id, current_user.id,
                "expense_recorded",
                f"recorded an expense of {amount_str} for {body.category} — {event.name}",
                reference_id=eid,
                reference_type="event",
                message_data={
                    "event_title": event.name,
                    "amount": body.amount,
                    "category": body.category,
                    "currency": currency,
                    "recorder_name": recorder_name,
                },
            )
            _send_expense_sms_wa(event.organizer_id)

    db.commit()
    db.refresh(expense)

    return standard_response(True, "Expense recorded successfully", _expense_to_dict(expense, db))


# ──────────────────────────────────────────────
# PUT /user-events/{event_id}/expenses/{expense_id}
# ──────────────────────────────────────────────
class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    vendor_name: Optional[str] = None
    expense_date: Optional[str] = None
    notes: Optional[str] = None


@router.put("/{event_id}/expenses/{expense_id}")
def update_expense(
    event_id: str,
    expense_id: str,
    body: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing expense. Requires can_manage_expenses or creator."""
    event, err = _check_expense_access(db, event_id, current_user, require_manage=True)
    if err:
        return err

    try:
        exp_uuid = uuid.UUID(expense_id)
    except ValueError:
        return standard_response(False, "Invalid expense ID format.")

    expense = db.query(EventExpense).filter(
        EventExpense.id == exp_uuid,
        EventExpense.event_id == uuid.UUID(event_id),
    ).first()
    if not expense:
        return standard_response(False, "Expense not found")

    if body.category is not None:
        expense.category = body.category
    if body.description is not None:
        expense.description = body.description
    if body.amount is not None:
        expense.amount = body.amount
    if body.payment_method is not None:
        expense.payment_method = body.payment_method
    if body.payment_reference is not None:
        expense.payment_reference = body.payment_reference
    if body.vendor_name is not None:
        expense.vendor_name = body.vendor_name
    if body.notes is not None:
        expense.notes = body.notes
    if body.expense_date:
        try:
            expense.expense_date = datetime.strptime(body.expense_date, "%Y-%m-%d")
        except ValueError:
            pass

    db.commit()
    db.refresh(expense)

    return standard_response(True, "Expense updated successfully", _expense_to_dict(expense, db))


# ──────────────────────────────────────────────
# DELETE /user-events/{event_id}/expenses/{expense_id}
# ──────────────────────────────────────────────
@router.delete("/{event_id}/expenses/{expense_id}")
def delete_expense(
    event_id: str,
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an expense. Requires can_manage_expenses or creator."""
    event, err = _check_expense_access(db, event_id, current_user, require_manage=True)
    if err:
        return err

    try:
        exp_uuid = uuid.UUID(expense_id)
    except ValueError:
        return standard_response(False, "Invalid expense ID format.")

    expense = db.query(EventExpense).filter(
        EventExpense.id == exp_uuid,
        EventExpense.event_id == uuid.UUID(event_id),
    ).first()
    if not expense:
        return standard_response(False, "Expense not found")

    db.delete(expense)
    db.commit()

    return standard_response(True, "Expense deleted successfully")


# ──────────────────────────────────────────────
# GET /user-events/{event_id}/expenses/report
# ──────────────────────────────────────────────
@router.get("/{event_id}/expenses/report")
def get_expense_report(
    event_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get expense report with optional date range filtering."""
    event, err = _check_expense_access(db, event_id, current_user, require_manage=False)
    if err:
        return err

    eid = uuid.UUID(event_id)
    currency = _currency_code(db, event.currency_id)

    query = db.query(EventExpense).filter(EventExpense.event_id == eid)

    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(EventExpense.expense_date >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(EventExpense.expense_date <= dt)
        except ValueError:
            pass

    expenses = query.order_by(EventExpense.category, EventExpense.expense_date).all()

    expense_list = []
    for e in expenses:
        recorder_name = None
        if e.recorded_by:
            recorder = db.query(User).filter(User.id == e.recorded_by).first()
            if recorder:
                recorder_name = f"{recorder.first_name} {recorder.last_name}"

        expense_list.append({
            "category": e.category,
            "description": e.description,
            "amount": float(e.amount) if e.amount else 0,
            "vendor_name": e.vendor_name,
            "expense_date": e.expense_date.isoformat() if e.expense_date else None,
            "payment_method": e.payment_method,
            "recorded_by_name": recorder_name,
        })

    # Summary always reflects full dataset (not filtered)
    summary = _expense_summary(db, eid, currency)

    return standard_response(True, "Expense report generated", {
        "expenses": expense_list,
        "summary": summary,
    })
