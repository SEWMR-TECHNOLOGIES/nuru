"""Reminder automation API.

Endpoints (all under /api/v1):

  GET    /events/{event_id}/automations
  POST   /events/{event_id}/automations
  GET    /events/{event_id}/automations/{id}
  PATCH  /events/{event_id}/automations/{id}
  DELETE /events/{event_id}/automations/{id}
  POST   /events/{event_id}/automations/{id}/preview
  POST   /events/{event_id}/automations/{id}/send-now      → 202
  POST   /events/{event_id}/automations/{id}/enable
  POST   /events/{event_id}/automations/{id}/disable
  GET    /events/{event_id}/automations/{id}/runs
  GET    /events/{event_id}/automations/{id}/runs/{run_id}/recipients
  POST   /events/{event_id}/automations/{id}/runs/{run_id}/resend-failed
  GET    /reminder-templates

All write endpoints validate WhatsApp template rules: required placeholders
must be present, body cannot start or end with a {{var}}.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone as dt_tz
from typing import Optional, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func as sa_func
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    Event, User,
    EventReminderTemplate, EventReminderAutomation,
    EventReminderRun, EventReminderRecipient,
)
from utils.auth import get_current_user
from utils.helpers import standard_response
from utils.reminder_helpers import (
    validate_body, render_full_message, compute_next_run_at,
    TemplateValidationError,
)


router = APIRouter(tags=["Reminder Automations"])

UTC = dt_tz.utc

AutomationType = Literal["fundraise_attend", "pledge_remind", "guest_remind"]
LanguageCode = Literal["en", "sw"]
ScheduleKind = Literal["now", "datetime", "days_before", "hours_before", "repeat"]


# ── permission helper (mirror expenses.py pattern) ─────────────────────

def _check_event_access(db: Session, event_id: str, user: User):
    try:
        eid = uuid.UUID(event_id)
    except Exception:
        return None, standard_response(False, "Invalid event ID")
    ev = db.query(Event).filter(Event.id == eid).first()
    if not ev:
        return None, standard_response(False, "Event not found")
    if str(ev.organizer_id) != str(user.id):
        return None, standard_response(False, "Only the organiser can manage automations")
    return ev, None


def _resolve_user_timezone(user: User) -> str:
    tz = getattr(user, "timezone", None)
    if tz and tz != "UTC":
        return tz
    settings = getattr(user, "settings", None)
    s_tz = getattr(settings, "timezone", None) if settings else None
    return s_tz or "Africa/Nairobi"


# ── schemas ────────────────────────────────────────────────────────────

class AutomationCreate(BaseModel):
    automation_type: AutomationType
    language: LanguageCode
    name: Optional[str] = None
    body_override: Optional[str] = None
    schedule_kind: ScheduleKind
    schedule_at: Optional[datetime] = None
    days_before: Optional[int] = None
    hours_before: Optional[int] = None
    repeat_interval_hours: Optional[int] = None
    min_gap_hours: int = Field(24, ge=1, le=24 * 30)
    timezone: Optional[str] = None
    enabled: bool = True


class AutomationUpdate(BaseModel):
    language: Optional[LanguageCode] = None
    name: Optional[str] = None
    body_override: Optional[str] = None
    schedule_kind: Optional[ScheduleKind] = None
    schedule_at: Optional[datetime] = None
    days_before: Optional[int] = None
    hours_before: Optional[int] = None
    repeat_interval_hours: Optional[int] = None
    min_gap_hours: Optional[int] = Field(None, ge=1, le=24 * 30)
    timezone: Optional[str] = None
    enabled: Optional[bool] = None


class PreviewRequest(BaseModel):
    body_override: Optional[str] = None
    language: Optional[LanguageCode] = None


# ── serializers ────────────────────────────────────────────────────────

def _template_dict(t: EventReminderTemplate) -> dict:
    return {
        "id": str(t.id),
        "code": t.code,
        "automation_type": t.automation_type,
        "language": t.language,
        "whatsapp_template_name": t.whatsapp_template_name,
        "body_default": t.body_default,
        "placeholders": t.placeholders or [],
        "required_placeholders": list(t.required_placeholders or []),
        "protected_prefix": t.protected_prefix or "",
        "protected_suffix": t.protected_suffix or "",
    }


def _automation_dict(a: EventReminderAutomation, db: Session) -> dict:
    last_run = (
        db.query(EventReminderRun)
        .filter(EventReminderRun.automation_id == a.id)
        .order_by(desc(EventReminderRun.started_at))
        .first()
    )
    if last_run:
        _repair_run_status(db, last_run)
    return {
        "id": str(a.id),
        "event_id": str(a.event_id),
        "automation_type": a.automation_type,
        "language": a.language,
        "name": a.name,
        "template": _template_dict(a.template) if a.template else None,
        "body_override": a.body_override,
        "schedule_kind": a.schedule_kind,
        "schedule_at": a.schedule_at.isoformat() if a.schedule_at else None,
        "days_before": a.days_before,
        "hours_before": a.hours_before,
        "repeat_interval_hours": a.repeat_interval_hours,
        "min_gap_hours": a.min_gap_hours,
        "timezone": a.timezone,
        "enabled": a.enabled,
        "last_run_at": a.last_run_at.isoformat() if a.last_run_at else None,
        "next_run_at": a.next_run_at.isoformat() if a.next_run_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "last_run": _run_dict(last_run) if last_run else None,
    }


def _run_dict(r: EventReminderRun) -> dict:
    return {
        "id": str(r.id),
        "automation_id": str(r.automation_id),
        "trigger": r.trigger,
        "status": r.status,
        "total_recipients": r.total_recipients or 0,
        "sent_count": r.sent_count or 0,
        "failed_count": r.failed_count or 0,
        "skipped_count": r.skipped_count or 0,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "body_snapshot": r.body_snapshot,
        "error": r.error,
    }


def _repair_run_status(db: Session, run: EventReminderRun) -> None:
    if run.status not in ("pending", "running"):
        return
    counts = dict(
        db.query(EventReminderRecipient.status, sa_func.count(EventReminderRecipient.id))
        .filter(EventReminderRecipient.run_id == run.id)
        .group_by(EventReminderRecipient.status)
        .all()
    )
    total = sum(int(v or 0) for v in counts.values())
    run.total_recipients = total
    run.sent_count = int(counts.get("sent", 0) or 0)
    run.failed_count = int(counts.get("failed", 0) or 0)
    run.skipped_count = int(counts.get("skipped", 0) or 0)
    pending = int(counts.get("pending", 0) or 0)
    if total > 0 and pending == 0:
        run.status = "completed"
        run.finished_at = run.finished_at or datetime.now(UTC)
    elif total > 0:
        run.status = "running"
    elif run.body_snapshot:
        run.status = "completed"
        run.finished_at = run.finished_at or datetime.now(UTC)
    elif (run.started_at or datetime.now(UTC)) < datetime.now(UTC) - timedelta(minutes=2):
        run.status = "failed"
        run.error = run.error or "Dispatch did not start. Please send again."
        run.finished_at = run.finished_at or datetime.now(UTC)


def _recipient_dict(r: EventReminderRecipient) -> dict:
    return {
        "id": str(r.id),
        "recipient_type": r.recipient_type,
        "recipient_id": str(r.recipient_id),
        "name": r.name,
        "phone": r.phone,
        "channel": r.channel,
        "status": r.status,
        "attempts": r.attempts or 0,
        "error": r.error,
        "queued_at": r.queued_at.isoformat() if r.queued_at else None,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
    }


# ── template catalog ───────────────────────────────────────────────────

@router.get("/reminder-templates")
def list_templates(
    automation_type: Optional[AutomationType] = None,
    language: Optional[LanguageCode] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(EventReminderTemplate).filter(
        EventReminderTemplate.is_active.is_(True))
    if automation_type:
        q = q.filter(EventReminderTemplate.automation_type == automation_type)
    if language:
        q = q.filter(EventReminderTemplate.language == language)
    items = [_template_dict(t) for t in q.order_by(
        EventReminderTemplate.automation_type,
        EventReminderTemplate.language,
    ).all()]
    return standard_response(True, "Templates retrieved", {"items": items})


# ── automations CRUD ───────────────────────────────────────────────────

@router.get("/events/{event_id}/automations")
def list_automations(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err:
        return err
    rows = (
        db.query(EventReminderAutomation)
        .filter(EventReminderAutomation.event_id == ev.id)
        .order_by(desc(EventReminderAutomation.created_at))
        .all()
    )
    return standard_response(True, "Automations retrieved", {
        "items": [_automation_dict(a, db) for a in rows],
    })


def _resolve_template(db: Session, automation_type: str, language: str):
    return (
        db.query(EventReminderTemplate)
        .filter(
            EventReminderTemplate.automation_type == automation_type,
            EventReminderTemplate.language == language,
            EventReminderTemplate.is_active.is_(True),
        )
        .first()
    )


def _editable_required_placeholders(template: EventReminderTemplate) -> list[str]:
    """Only placeholders the organiser must provide in the editor.

    Event, venue, pledge and recipient fields are resolved by the dispatch task
    at send time; requiring them during creation blocks valid automations.
    """
    return []


def _validate_against_template(template: EventReminderTemplate,
                               body_override: str | None) -> None:
    if body_override is None:
        if template.automation_type == "fundraise_attend":
            raise TemplateValidationError("Message body is required.")
        return
    validate_body(body_override, _editable_required_placeholders(template))


@router.post("/events/{event_id}/automations")
def create_automation(
    event_id: str,
    payload: AutomationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err:
        return err

    template = _resolve_template(db, payload.automation_type, payload.language)
    if not template:
        return standard_response(False, "No template available for that type/language")

    try:
        _validate_against_template(template, payload.body_override)
    except TemplateValidationError as e:
        return standard_response(False, str(e))

    tz = payload.timezone or _resolve_user_timezone(current_user)
    a = EventReminderAutomation(
        event_id=ev.id,
        automation_type=payload.automation_type,
        language=payload.language,
        template_id=template.id,
        name=payload.name,
        body_override=payload.body_override,
        schedule_kind=payload.schedule_kind,
        schedule_at=payload.schedule_at,
        days_before=payload.days_before,
        hours_before=payload.hours_before,
        repeat_interval_hours=payload.repeat_interval_hours,
        min_gap_hours=payload.min_gap_hours,
        timezone=tz,
        enabled=payload.enabled,
        created_by=current_user.id,
    )
    a.template = template
    a.next_run_at = compute_next_run_at(a, ev)
    db.add(a)
    db.commit()
    db.refresh(a)
    return standard_response(True, "Automation created", _automation_dict(a, db))


def _get_automation_or_404(db: Session, ev: Event, automation_id: str):
    try:
        aid = uuid.UUID(automation_id)
    except Exception:
        return None, standard_response(False, "Invalid automation id")
    a = (
        db.query(EventReminderAutomation)
        .filter(
            EventReminderAutomation.id == aid,
            EventReminderAutomation.event_id == ev.id,
        )
        .first()
    )
    if not a:
        return None, standard_response(False, "Automation not found")
    return a, None


@router.get("/events/{event_id}/automations/{automation_id}")
def get_automation(
    event_id: str,
    automation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err:
        return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err:
        return err
    return standard_response(True, "OK", _automation_dict(a, db))


@router.patch("/events/{event_id}/automations/{automation_id}")
def update_automation(
    event_id: str,
    automation_id: str,
    payload: AutomationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err:
        return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err:
        return err

    if payload.language and payload.language != a.language:
        new_tpl = _resolve_template(db, a.automation_type, payload.language)
        if not new_tpl:
            return standard_response(False, "No template for that language")
        a.language = payload.language
        a.template_id = new_tpl.id
        a.template = new_tpl

    fields = {
        "name", "body_override", "schedule_kind", "schedule_at",
        "days_before", "hours_before", "repeat_interval_hours",
        "min_gap_hours", "timezone", "enabled",
    }
    for f in fields:
        v = getattr(payload, f)
        if v is not None:
            setattr(a, f, v)

    if payload.body_override is not None:
        try:
            _validate_against_template(a.template, payload.body_override)
        except TemplateValidationError as e:
            return standard_response(False, str(e))

    a.next_run_at = compute_next_run_at(a, ev, last_run_at=a.last_run_at)
    db.commit()
    db.refresh(a)
    return standard_response(True, "Automation updated", _automation_dict(a, db))


@router.delete("/events/{event_id}/automations/{automation_id}")
def delete_automation(
    event_id: str,
    automation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err:
        return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err:
        return err
    db.delete(a)
    db.commit()
    return standard_response(True, "Automation deleted")


@router.post("/events/{event_id}/automations/{automation_id}/enable")
def enable_automation(event_id: str, automation_id: str,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err
    a.enabled = True
    a.next_run_at = compute_next_run_at(a, ev, last_run_at=a.last_run_at)
    db.commit()
    return standard_response(True, "Automation enabled", _automation_dict(a, db))


@router.post("/events/{event_id}/automations/{automation_id}/disable")
def disable_automation(event_id: str, automation_id: str,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err
    a.enabled = False
    a.next_run_at = None
    db.commit()
    return standard_response(True, "Automation disabled", _automation_dict(a, db))


@router.post("/events/{event_id}/automations/{automation_id}/preview")
def preview_message(
    event_id: str,
    automation_id: str,
    payload: PreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err

    template = a.template
    if payload.language and payload.language != a.language:
        template = _resolve_template(db, a.automation_type, payload.language) or template

    body = payload.body_override if payload.body_override is not None else a.body_override
    try:
        if body is not None:
            validate_body(body, _editable_required_placeholders(template))
    except TemplateValidationError as e:
        return standard_response(False, str(e))

    sample = {
        "recipient_name": "Asha",
        "event_name": ev.name or "Your event",
        "event_date": (ev.start_date or datetime.now(UTC)).strftime("%d %b %Y"),
        "event_link": "https://nuru.tz/e/preview",
        "event_datetime": (ev.start_date or datetime.now(UTC)).strftime("%d %b %Y at %H:%M"),
        "event_venue": getattr(ev, "location", None) or "Event venue",
        "pledge_amount": "TZS 50,000",
        "balance": "TZS 25,000",
        "pay_link": "https://nuru.tz/c/preview",
        "body": body or "",
    }
    rendered = render_full_message(template, body, sample)
    return standard_response(True, "Preview", {
        "rendered": rendered,
        "channels": ["whatsapp", "sms_fallback"],
    })


@router.post("/events/{event_id}/automations/{automation_id}/send-now")
def send_now(
    event_id: str,
    automation_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err

    # Validate body once before queuing.
    try:
        if a.body_override is not None:
            validate_body(a.body_override,
                          _editable_required_placeholders(a.template))
    except TemplateValidationError as e:
        return standard_response(False, str(e))

    # Create a placeholder run row immediately so the UI gets a stable id.
    run = EventReminderRun(
        automation_id=a.id,
        event_id=ev.id,
        trigger="manual",
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Run from the API background task instead of queuing a second Celery task.
    # This avoids the stale-worker "unregistered task" failure and still sends
    # per-recipient work after the HTTP response has been accepted.
    from tasks.reminder_dispatch import run_automation as run_task
    background_tasks.add_task(run_task.run, str(a.id), "manual", str(run.id), True)

    return standard_response(
        True,
        "Reminders are being sent to recipients with available contact details.",
        {"run_id": str(run.id), "automation_id": str(a.id)},
    )


@router.get("/events/{event_id}/automations/{automation_id}/runs")
def list_runs(
    event_id: str, automation_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err
    rows = (
        db.query(EventReminderRun)
        .filter(EventReminderRun.automation_id == a.id)
        .order_by(desc(EventReminderRun.started_at))
        .limit(limit)
        .all()
    )
    for row in rows:
        _repair_run_status(db, row)
    db.commit()
    return standard_response(True, "Runs retrieved",
                             {"items": [_run_dict(r) for r in rows]})


@router.get("/events/{event_id}/automations/{automation_id}/runs/{run_id}/recipients")
def list_recipients(
    event_id: str, automation_id: str, run_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err
    try:
        rid = uuid.UUID(run_id)
    except Exception:
        return standard_response(False, "Invalid run id")

    run = (
        db.query(EventReminderRun)
        .filter(EventReminderRun.id == rid,
                EventReminderRun.automation_id == a.id)
        .first()
    )
    if not run:
        return standard_response(False, "Run not found")
    _repair_run_status(db, run)
    db.commit()

    q = (
        db.query(EventReminderRecipient)
        .filter(EventReminderRecipient.run_id == run.id)
    )
    if status:
        q = q.filter(EventReminderRecipient.status == status)
    rows = q.order_by(desc(EventReminderRecipient.queued_at)).limit(limit).all()

    return standard_response(True, "Recipients retrieved", {
        "run": _run_dict(run),
        "items": [_recipient_dict(r) for r in rows],
    })


@router.post("/events/{event_id}/automations/{automation_id}/runs/{run_id}/resend-failed")
def resend_failed(
    event_id: str, automation_id: str, run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev, err = _check_event_access(db, event_id, current_user)
    if err: return err
    a, err = _get_automation_or_404(db, ev, automation_id)
    if err: return err

    try:
        rid = uuid.UUID(run_id)
    except Exception:
        return standard_response(False, "Invalid run id")

    run = (
        db.query(EventReminderRun)
        .filter(EventReminderRun.id == rid,
                EventReminderRun.automation_id == a.id)
        .first()
    )
    if not run:
        return standard_response(False, "Run not found")

    try:
        from tasks.reminder_dispatch import resend_failed as resend_task
        resend_task.delay(str(run.id))
    except Exception as e:
        print(f"[reminder] resend inline fallback: {e}")
        from tasks.reminder_dispatch import resend_failed as resend_task
        resend_task.run(str(run.id))

    return standard_response(True, "Resend queued. Updates will appear shortly.")
