"""Celery task — bulk Committee / Guest member import.

Triggered from:
  • POST /user-events/{event_id}/committee/import
  • POST /user-events/{event_id}/guests/import

Each row resolves (or creates) a Nuru user using phone as the dedupe key,
then attaches that user to the committee or the guest list. Idempotent —
existing memberships are reported as duplicates and skipped.

The task purposefully reuses the existing helpers used by single-add
endpoints (`utils.validation_functions.validate_phone_number`,
`utils.sms.sms_committee_invite`, `utils.sms.sms_guest_added`,
`utils.notify.notify_*`) so behaviour stays identical to the per-row UI.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pytz
from passlib.hash import bcrypt
from sqlalchemy.exc import IntegrityError

from core.celery_app import celery_app
from core.database import SessionLocal
from models import (
    CommitteePermission,
    CommitteeRole,
    Event,
    EventAttendee,
    EventCommitteeMember,
    EventInvitation,
    MemberImportJob,
    User,
)
from models.enums import GuestTypeEnum, RSVPStatusEnum
from utils.validation_functions import validate_phone_number


EAT = pytz.timezone("Africa/Dar_es_Salaam")

# Only mobile money markets we currently support — anything else is
# rejected with a clear error so organisers don't quietly import phones
# that can't receive notifications.
ALLOWED_CC_PREFIXES: Tuple[str, ...] = ("255", "254")


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _split_full_name(raw: str) -> Tuple[str, str]:
    """First word → first_name, remaining words → last_name. Trims whitespace.
    Falls back to ('Guest', '') only when the row has no usable text — the
    caller is expected to validate emptiness before calling this."""
    parts = [p for p in (raw or "").strip().split() if p]
    if not parts:
        return ("", "")
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], " ".join(parts[1:]))


def _normalize_invitation_code() -> str:
    return secrets.token_hex(6)


def _resolve_or_create_user(db, raw_phone: str, full_name: str, registered_by: str) -> Tuple[Optional[User], bool, Optional[str]]:
    """Returns (user, was_created, error_message).

    Bulk imports REQUIRE the international format. Unlike the single-add UI
    we do NOT silently rewrite a local 07.../06... number to 2557.../2556...,
    because spreadsheets routinely strip leading zeros and a bare "712345678"
    is ambiguous (could be TZ, KE, or anything else). Organisers must supply
    a country code so we can guarantee the right user is matched/created.
    """
    cleaned = "".join(ch for ch in (raw_phone or "") if ch.isdigit() or ch == "+").strip()
    if not cleaned:
        return (None, False, "Phone is required")

    digits_only = cleaned.lstrip("+")
    # Reject local formats — they must include the country code.
    if cleaned.startswith("0") or (not cleaned.startswith("+") and not any(digits_only.startswith(p) for p in ALLOWED_CC_PREFIXES)):
        return (None, False, "Phone must be in international format (e.g. +255712345678 or 255712345678). Local formats like 07... are not accepted.")

    try:
        normalized = validate_phone_number(cleaned)
    except ValueError as exc:
        return (None, False, str(exc))

    if not any(normalized.startswith(p) for p in ALLOWED_CC_PREFIXES):
        return (None, False, f"Only +{ '/+'.join(ALLOWED_CC_PREFIXES) } mobile numbers are supported (got +{normalized}).")


    plus_form = f"+{normalized}"
    username = f"u{normalized}"
    existing = (
        db.query(User)
        .filter((User.phone == normalized) | (User.phone == plus_form) | (User.username == username))
        .first()
    )
    if existing:
        return (existing, False, None)

    first_name, last_name = _split_full_name(full_name)
    if not first_name:
        return (None, False, "Full name is required")

    # Match the single-add UserSearchInput.register flow: default password
    # Nuru@2026, stored hashed.
    user = User(
        id=uuid.uuid4(),
        first_name=first_name,
        last_name=last_name or first_name,
        phone=normalized,
        username=username,
        password_hash=bcrypt.hash("Nuru@2026"),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing_after_race = (
            db.query(User)
            .filter((User.phone == normalized) | (User.phone == plus_form) | (User.username == username))
            .first()
        )
        if existing_after_race:
            return (existing_after_race, False, None)
        return (None, False, "Could not create user because that phone or username already exists")
    except Exception as e:
        db.rollback()
        return (None, False, f"Could not create user: {e}")
    return (user, True, None)


# ──────────────────────────────────────────────
# Committee mode
# ──────────────────────────────────────────────

def _assign_committee(db, event: Event, user: User, assigned_by_id, now) -> Tuple[bool, Optional[str]]:
    """Returns (created_new, error). Reused-existing → (False, None)."""
    existing = (
        db.query(EventCommitteeMember)
        .filter(
            EventCommitteeMember.event_id == event.id,
            EventCommitteeMember.user_id == user.id,
        )
        .first()
    )
    if existing:
        return (False, None)

    # Default to a "Member" role for bulk imports — organisers can edit
    # roles individually afterwards.
    role = db.query(CommitteeRole).filter(CommitteeRole.role_name == "Member").first()
    if not role:
        role = CommitteeRole(
            id=uuid.uuid4(),
            role_name="Member",
            description="Committee member",
            created_at=now,
            updated_at=now,
        )
        db.add(role)
        db.flush()

    cm = EventCommitteeMember(
        id=uuid.uuid4(),
        event_id=event.id,
        user_id=user.id,
        role_id=role.id,
        assigned_by=assigned_by_id,
        assigned_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(cm)
    db.flush()
    db.add(CommitteePermission(
        id=uuid.uuid4(),
        committee_member_id=cm.id,
        created_at=now,
        updated_at=now,
    ))
    return (True, None)


# ──────────────────────────────────────────────
# Guest mode
# ──────────────────────────────────────────────

def _assign_guest(
    db,
    event: Event,
    user: User,
    common_name: Optional[str],
    invited_by_id,
    now,
) -> Tuple[bool, Optional[str]]:
    existing = (
        db.query(EventAttendee)
        .filter(
            EventAttendee.event_id == event.id,
            EventAttendee.attendee_id == user.id,
        )
        .first()
    )
    if existing:
        # Backfill common_name on duplicate rows so a later upload with the
        # display label still wins, without re-inviting.
        if common_name and not existing.common_name:
            existing.common_name = common_name
            existing.updated_at = now
        return (False, None)

    invitation = EventInvitation(
        id=uuid.uuid4(),
        event_id=event.id,
        guest_type=GuestTypeEnum.user,
        invited_user_id=user.id,
        invited_by_user_id=invited_by_id,
        invitation_code=_normalize_invitation_code(),
        rsvp_status=RSVPStatusEnum.pending,
        created_at=now,
        updated_at=now,
    )
    db.add(invitation)
    db.flush()

    att = EventAttendee(
        id=uuid.uuid4(),
        event_id=event.id,
        guest_type=GuestTypeEnum.user,
        attendee_id=user.id,
        common_name=common_name or None,
        invitation_id=invitation.id,
        rsvp_status=RSVPStatusEnum.pending,
        created_at=now,
        updated_at=now,
    )
    db.add(att)
    return (True, None)


# ──────────────────────────────────────────────
# Celery task
# ──────────────────────────────────────────────

@celery_app.task(name="members.process_import_job", bind=True, max_retries=2)
def process_member_import_job(self, job_id: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        job: Optional[MemberImportJob] = (
            db.query(MemberImportJob)
            .filter(MemberImportJob.id == uuid.UUID(str(job_id)))
            .first()
        )
        if not job:
            return {"ok": False, "error": "job-not-found"}
        if job.status not in ("queued", "failed"):
            return {"ok": True, "status": job.status}

        event = db.query(Event).filter(Event.id == job.event_id).first()
        if not event:
            job.status = "failed"
            job.error_message = "Event not found"
            job.finished_at = datetime.utcnow()
            db.commit()
            return {"ok": False, "error": "event-not-found"}

        rows: List[Dict[str, Any]] = list(job.payload.get("rows") or [])
        mode = (job.mode or "guests").strip()
        notify_sms = bool(job.notify_sms)

        job.status = "processing"
        job.started_at = datetime.utcnow()
        job.total_rows = len(rows)
        job.processed_rows = 0
        job.successful_rows = 0
        job.reused_rows = 0
        job.duplicate_rows = 0
        job.invalid_phone_rows = 0
        job.failed_rows = 0
        job.errors = []
        db.commit()

        organizer = db.query(User).filter(User.id == event.organizer_id).first()
        from utils.event_owner import get_event_owner_display_name
        organizer_name = get_event_owner_display_name(
            event, db=db,
            fallback=(f"{organizer.first_name} {organizer.last_name}".strip() if organizer else "Nuru"),
        )

        errors: List[Dict[str, Any]] = []
        sms_queue: List[Tuple[str, str]] = []  # (user_phone, user_first_name) for newly-assigned only
        success_count = 0
        reused_count = 0
        duplicate_count = 0
        invalid_phone_count = 0
        failure_count = 0

        for idx, row in enumerate(rows):
            row_num = int(row.get("_row") or (idx + 1))
            try:
                full_name = (row.get("full_name") or "").strip()
                phone_raw = (row.get("phone") or "").strip()
                common_name = (row.get("common_name") or "").strip() or None

                if not full_name:
                    errors.append({"row": row_num, "message": "Full name is required"})
                    failure_count += 1
                    continue
                if not phone_raw:
                    errors.append({"row": row_num, "message": f"Phone is required for {full_name}"})
                    failure_count += 1
                    continue

                user, created, err = _resolve_or_create_user(
                    db, phone_raw, full_name, registered_by=organizer_name
                )
                if err or not user:
                    if err and "Only +" in err or err and "Phone" in err or err and "Tanzanian" in err:
                        invalid_phone_count += 1
                    else:
                        failure_count += 1
                    errors.append({"row": row_num, "message": err or "Unknown error"})
                    continue

                if not created:
                    reused_count += 1

                now = datetime.now(EAT)
                if mode == "committee":
                    created_assignment, err2 = _assign_committee(
                        db, event, user, organizer.id if organizer else event.organizer_id, now,
                    )
                else:
                    created_assignment, err2 = _assign_guest(
                        db, event, user, common_name, organizer.id if organizer else event.organizer_id, now,
                    )

                if err2:
                    failure_count += 1
                    errors.append({"row": row_num, "message": err2})
                    continue

                if created_assignment:
                    success_count += 1
                    if notify_sms and user.phone:
                        sms_queue.append((user.phone, user.first_name or "Friend"))
                else:
                    duplicate_count += 1
            except Exception as e:  # pragma: no cover
                try:
                    db.rollback()
                except Exception:
                    pass
                failure_count += 1
                errors.append({"row": row_num, "message": str(e)})
            finally:
                job.processed_rows = idx + 1
                job.successful_rows = success_count
                job.reused_rows = reused_count
                job.duplicate_rows = duplicate_count
                job.invalid_phone_rows = invalid_phone_count
                job.failed_rows = failure_count
                job.errors = errors
                db.commit()

        db.commit()

        # Fire SMS only for newly-assigned rows, never for duplicates/reused.
        if notify_sms and sms_queue:
            try:
                if mode == "committee":
                    from utils.sms import sms_committee_invite
                    for phone, first in sms_queue:
                        try:
                            sms_committee_invite(phone, first, event.name, "Member", organizer_name, custom_message="")
                        except Exception as e:
                            print(f"[member_import] SMS committee failed: {e}")
                else:
                    from utils.sms import sms_guest_added
                    # Use a synthetic code so the SMS template still renders.
                    for phone, first in sms_queue:
                        try:
                            sms_guest_added(phone, first, event.name, "", organizer_name, "")
                        except Exception as e:
                            print(f"[member_import] SMS guest failed: {e}")
            except Exception as e:  # pragma: no cover
                print(f"[member_import] SMS dispatch fatal: {e}")

        job.processed_rows = len(rows)
        job.successful_rows = success_count
        job.reused_rows = reused_count
        job.duplicate_rows = duplicate_count
        job.invalid_phone_rows = invalid_phone_count
        job.failed_rows = failure_count
        job.errors = errors
        job.finished_at = datetime.utcnow()
        job.status = (
            "completed" if failure_count == 0 and invalid_phone_count == 0
            else ("partially_completed" if (success_count + duplicate_count + reused_count) > 0 else "failed")
        )
        db.commit()
        return {
            "ok": True,
            "status": job.status,
            "summary": {
                "total": job.total_rows,
                "successful": success_count,
                "reused": reused_count,
                "duplicates": duplicate_count,
                "invalid_phone": invalid_phone_count,
                "failed": failure_count,
            },
        }
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        raise self.retry(exc=e)
    finally:
        db.close()
