# Templates & Checklists Routes - /templates/... and integrated into /user-events/...
# Handles event template browsing and per-event checklist management

import math
import uuid
from datetime import datetime, timedelta

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    Event, EventType, EventTemplate, EventTemplateTask, EventChecklistItem,
    EventCommitteeMember, CommitteePermission, User,
    PriorityLevelEnum, ChecklistItemStatusEnum,
)
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")

router = APIRouter(tags=["Templates & Checklists"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _verify_event_access(db: Session, event_id, current_user, required_permission: str = None):
    """Check creator or committee member access."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return None, standard_response(False, "Event not found")
    is_creator = str(event.organizer_id) == str(current_user.id)
    if is_creator:
        return event, None
    cm = db.query(EventCommitteeMember).filter(
        EventCommitteeMember.event_id == event_id,
        EventCommitteeMember.user_id == current_user.id,
    ).first()
    if not cm:
        return None, standard_response(False, "You do not have permission to access this event")
    if not required_permission:
        return event, None
    perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
    if not perms or not getattr(perms, required_permission, False):
        return None, standard_response(False, "You do not have permission to perform this action")
    return event, None


def _template_dict(template: EventTemplate) -> dict:
    return {
        "id": str(template.id),
        "event_type_id": str(template.event_type_id),
        "name": template.name,
        "description": template.description,
        "estimated_budget_min": template.estimated_budget_min,
        "estimated_budget_max": template.estimated_budget_max,
        "estimated_timeline_days": template.estimated_timeline_days,
        "guest_range_min": template.guest_range_min,
        "guest_range_max": template.guest_range_max,
        "tips": template.tips or [],
        "task_count": len(template.tasks) if template.tasks else 0,
        "tasks": [_template_task_dict(t) for t in (template.tasks or [])],
        "display_order": template.display_order,
    }


def _template_task_dict(task: EventTemplateTask) -> dict:
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "category": task.category,
        "priority": task.priority.value if hasattr(task.priority, "value") else task.priority,
        "days_before_event": task.days_before_event,
        "display_order": task.display_order,
    }


def _checklist_item_dict(item: EventChecklistItem) -> dict:
    return {
        "id": str(item.id),
        "event_id": str(item.event_id),
        "template_task_id": str(item.template_task_id) if item.template_task_id else None,
        "title": item.title,
        "description": item.description,
        "category": item.category,
        "priority": item.priority.value if hasattr(item.priority, "value") else item.priority,
        "status": item.status.value if hasattr(item.status, "value") else item.status,
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
        "assigned_to": item.assigned_to,
        "notes": item.notes,
        "display_order": item.display_order,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ──────────────────────────────────────────────
# Browse Templates (Public)
# ──────────────────────────────────────────────
@router.get("/templates")
def list_templates(
    event_type_id: str = None,
    db: Session = Depends(get_db),
):
    """List available event templates, optionally filtered by event type."""
    query = db.query(EventTemplate).filter(EventTemplate.is_active == True)
    if event_type_id:
        try:
            query = query.filter(EventTemplate.event_type_id == uuid.UUID(event_type_id))
        except ValueError:
            pass
    templates = query.order_by(EventTemplate.display_order.asc(), EventTemplate.name.asc()).all()
    return standard_response(True, "Templates retrieved successfully", [_template_dict(t) for t in templates])


@router.get("/templates/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db)):
    """Get a single template with all its tasks."""
    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        return standard_response(False, "Invalid template ID format")
    template = db.query(EventTemplate).filter(EventTemplate.id == tid, EventTemplate.is_active == True).first()
    if not template:
        return standard_response(False, "Template not found")
    return standard_response(True, "Template retrieved successfully", _template_dict(template))


# ──────────────────────────────────────────────
# Event Checklist CRUD
# ──────────────────────────────────────────────
@router.get("/user-events/{event_id}/checklist")
def get_checklist(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all checklist items for an event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    items = (
        db.query(EventChecklistItem)
        .filter(EventChecklistItem.event_id == eid)
        .order_by(EventChecklistItem.display_order.asc(), EventChecklistItem.created_at.asc())
        .all()
    )

    total = len(items)
    completed = sum(1 for i in items if (i.status.value if hasattr(i.status, "value") else i.status) == "completed")
    in_progress = sum(1 for i in items if (i.status.value if hasattr(i.status, "value") else i.status) == "in_progress")

    return standard_response(True, "Checklist retrieved successfully", {
        "items": [_checklist_item_dict(i) for i in items],
        "summary": {
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": total - completed - in_progress,
            "progress_percentage": round((completed / total * 100), 1) if total > 0 else 0,
        },
    })


@router.post("/user-events/{event_id}/checklist")
def add_checklist_item(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a custom checklist item to an event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event, err = _verify_event_access(db, eid, current_user, "can_edit_event")
    if err:
        return err

    title = (body.get("title") or "").strip()
    if not title:
        return standard_response(False, "Title is required", errors=[{"field": "title", "message": "Title is required"}])

    # Get max display_order
    max_order = db.query(sa_func.max(EventChecklistItem.display_order)).filter(EventChecklistItem.event_id == eid).scalar() or 0

    priority_val = body.get("priority", "medium")
    try:
        priority = PriorityLevelEnum(priority_val)
    except ValueError:
        priority = PriorityLevelEnum.medium

    due_date = None
    if body.get("due_date"):
        try:
            due_date = datetime.fromisoformat(body["due_date"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    item = EventChecklistItem(
        id=uuid.uuid4(),
        event_id=eid,
        title=title,
        description=body.get("description"),
        category=body.get("category"),
        priority=priority,
        due_date=due_date,
        assigned_to=body.get("assigned_to"),
        notes=body.get("notes"),
        display_order=max_order + 1,
        created_at=datetime.now(EAT),
        updated_at=datetime.now(EAT),
    )

    db.add(item)
    try:
        db.commit()
        db.refresh(item)
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to add checklist item: {str(e)}")

    return standard_response(True, "Checklist item added successfully", _checklist_item_dict(item))


@router.put("/user-events/{event_id}/checklist/{item_id}")
def update_checklist_item(
    event_id: str,
    item_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a checklist item."""
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(item_id)
    except ValueError:
        return standard_response(False, "Invalid ID format")

    event, err = _verify_event_access(db, eid, current_user, "can_edit_event")
    if err:
        return err

    item = db.query(EventChecklistItem).filter(EventChecklistItem.id == iid, EventChecklistItem.event_id == eid).first()
    if not item:
        return standard_response(False, "Checklist item not found")

    now = datetime.now(EAT)

    if "title" in body and body["title"]:
        item.title = body["title"].strip()
    if "description" in body:
        item.description = body["description"]
    if "category" in body:
        item.category = body["category"]
    if "priority" in body:
        try:
            item.priority = PriorityLevelEnum(body["priority"])
        except ValueError:
            pass
    if "status" in body:
        try:
            new_status = ChecklistItemStatusEnum(body["status"])
            item.status = new_status
            if new_status == ChecklistItemStatusEnum.completed:
                item.completed_at = now
            elif item.completed_at:
                item.completed_at = None
        except ValueError:
            pass
    if "due_date" in body:
        if body["due_date"]:
            try:
                item.due_date = datetime.fromisoformat(body["due_date"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
        else:
            item.due_date = None
    if "assigned_to" in body:
        item.assigned_to = body["assigned_to"]
    if "notes" in body:
        item.notes = body["notes"]
    if "display_order" in body:
        item.display_order = body["display_order"]

    item.updated_at = now

    try:
        db.commit()
        db.refresh(item)
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to update checklist item: {str(e)}")

    return standard_response(True, "Checklist item updated successfully", _checklist_item_dict(item))


@router.delete("/user-events/{event_id}/checklist/{item_id}")
def delete_checklist_item(
    event_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a checklist item."""
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(item_id)
    except ValueError:
        return standard_response(False, "Invalid ID format")

    event, err = _verify_event_access(db, eid, current_user, "can_edit_event")
    if err:
        return err

    item = db.query(EventChecklistItem).filter(EventChecklistItem.id == iid, EventChecklistItem.event_id == eid).first()
    if not item:
        return standard_response(False, "Checklist item not found")

    try:
        db.delete(item)
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete checklist item: {str(e)}")

    return standard_response(True, "Checklist item deleted successfully")


@router.post("/user-events/{event_id}/checklist/from-template")
def apply_template(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a template's tasks to an event's checklist."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event, err = _verify_event_access(db, eid, current_user, "can_edit_event")
    if err:
        return err

    template_id = body.get("template_id")
    if not template_id:
        return standard_response(False, "template_id is required")

    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        return standard_response(False, "Invalid template ID format")

    template = db.query(EventTemplate).filter(EventTemplate.id == tid, EventTemplate.is_active == True).first()
    if not template:
        return standard_response(False, "Template not found")

    clear_existing = body.get("clear_existing", False)
    if clear_existing:
        db.query(EventChecklistItem).filter(EventChecklistItem.event_id == eid).delete()

    max_order = db.query(sa_func.max(EventChecklistItem.display_order)).filter(EventChecklistItem.event_id == eid).scalar() or 0

    now = datetime.now(EAT)
    added = 0

    for task in template.tasks:
        if not task.is_active:
            continue

        due_date = None
        if task.days_before_event and event.start_date:
            try:
                due_date = datetime.combine(event.start_date, datetime.min.time()) - timedelta(days=task.days_before_event)
            except Exception:
                pass

        max_order += 1
        item = EventChecklistItem(
            id=uuid.uuid4(),
            event_id=eid,
            template_task_id=task.id,
            title=task.title,
            description=task.description,
            category=task.category,
            priority=task.priority,
            due_date=due_date,
            display_order=max_order,
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        added += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to apply template: {str(e)}")

    return standard_response(True, f"Template applied — {added} tasks added to checklist", {"added": added, "template_name": template.name})


@router.put("/user-events/{event_id}/checklist/reorder")
def reorder_checklist(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder checklist items."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event, err = _verify_event_access(db, eid, current_user, "can_edit_event")
    if err:
        return err

    items = body.get("items", [])
    now = datetime.now(EAT)

    for entry in items:
        try:
            iid = uuid.UUID(entry.get("id", ""))
            order = int(entry.get("display_order", 0))
        except (ValueError, TypeError):
            continue

        item = db.query(EventChecklistItem).filter(EventChecklistItem.id == iid, EventChecklistItem.event_id == eid).first()
        if item:
            item.display_order = order
            item.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to reorder: {str(e)}")

    return standard_response(True, "Checklist reordered successfully")
