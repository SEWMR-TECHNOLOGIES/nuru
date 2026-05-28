"""Celery task that processes a queued contributor import job.

Mirrors the inline logic that used to live in
``POST /events/{event_id}/contributors/bulk`` so behaviour stays
identical, with the difference that work happens in the background and
the HTTP request returns immediately with a ``job_id``.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List

import pytz

from core.celery_app import celery_app
from core.database import SessionLocal
from models import (
    ContributorImportJob,
    Event,
    EventContributor,
    User,
    UserContributor,
)
from utils.helpers import format_phone_display
from utils.validation_functions import validate_phone_number


EAT = pytz.timezone("Africa/Dar_es_Salaam")


def _currency_code(db, event: Event) -> str:
    try:
        from models import Currency
        if event.currency_id:
            cur = db.query(Currency).filter(Currency.id == event.currency_id).first()
            if cur and cur.code:
                return cur.code
    except Exception:
        pass
    return "TZS"


@celery_app.task(name="contributors.process_import_job", bind=True, max_retries=2)
def process_contributor_import_job(self, job_id: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        job: ContributorImportJob | None = (
            db.query(ContributorImportJob)
            .filter(ContributorImportJob.id == uuid.UUID(str(job_id)))
            .first()
        )
        if not job:
            return {"ok": False, "error": "job-not-found"}
        if job.status not in ("queued", "failed"):
            # Already processing or finished - idempotent no-op.
            return {"ok": True, "status": job.status}

        event = db.query(Event).filter(Event.id == job.event_id).first()
        if not event:
            job.status = "failed"
            job.error_message = "Event not found"
            job.finished_at = datetime.utcnow()
            db.commit()
            return {"ok": False, "error": "event-not-found"}

        rows: List[Dict[str, Any]] = list(job.payload.get("contributors") or [])
        send_sms = bool(job.send_sms)
        mode = (job.mode or "targets").strip()

        job.status = "processing"
        job.started_at = datetime.utcnow()
        job.total_rows = len(rows)
        job.processed_rows = 0
        job.successful_rows = 0
        job.failed_rows = 0
        job.errors = []
        db.commit()

        now = datetime.now(EAT)
        currency = _currency_code(db, event)
        organizer = db.query(User).filter(User.id == event.organizer_id).first()
        organizer_phone = (
            format_phone_display(organizer.phone) if organizer and organizer.phone else None
        )

        errors: List[Dict[str, Any]] = []
        success_count = 0
        failure_count = 0

        for idx, row in enumerate(rows):
            row_num = idx + 1
            try:
                name = (row.get("name") or "").strip()
                phone_raw = (row.get("phone") or "").strip()
                amount = float(row.get("amount") or 0)

                if not name:
                    errors.append({"row": row_num, "message": "Name is required"})
                    failure_count += 1
                    continue
                if not phone_raw:
                    errors.append({"row": row_num, "message": f"Phone is required for {name}"})
                    failure_count += 1
                    continue
                try:
                    phone = validate_phone_number(phone_raw)
                except ValueError:
                    errors.append({
                        "row": row_num,
                        "message": f"Invalid phone for {name}: {phone_raw}",
                    })
                    failure_count += 1
                    continue

                contributor = (
                    db.query(UserContributor)
                    .filter(
                        UserContributor.user_id == job.created_by,
                        UserContributor.phone == phone,
                    )
                    .first()
                )
                if not contributor:
                    contributor = UserContributor(
                        id=uuid.uuid4(),
                        user_id=job.created_by,
                        name=name,
                        phone=phone,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(contributor)
                    db.flush()
                elif name and contributor.name != name:
                    contributor.name = name
                    contributor.updated_at = now

                ec = (
                    db.query(EventContributor)
                    .filter(
                        EventContributor.event_id == event.id,
                        EventContributor.contributor_id == contributor.id,
                    )
                    .first()
                )

                if mode == "targets":
                    if ec:
                        ec.pledge_amount = amount
                        ec.updated_at = now
                    else:
                        ec = EventContributor(
                            id=uuid.uuid4(),
                            event_id=event.id,
                            contributor_id=contributor.id,
                            pledge_amount=amount,
                            created_at=now,
                            updated_at=now,
                        )
                        db.add(ec)
                        db.flush()
                else:
                    if not ec:
                        ec = EventContributor(
                            id=uuid.uuid4(),
                            event_id=event.id,
                            contributor_id=contributor.id,
                            pledge_amount=0,
                            created_at=now,
                            updated_at=now,
                        )
                        db.add(ec)
                        db.flush()
                    # Contribution recording delegates to existing helpers
                    # to keep semantics aligned with the inline path.
                    if amount > 0:
                        try:
                            from models import EventContribution, PaymentMethodEnum
                            pm = None
                            if job.payment_method:
                                try:
                                    pm = PaymentMethodEnum(job.payment_method)
                                except Exception:
                                    pm = None
                            db.add(EventContribution(
                                id=uuid.uuid4(),
                                event_id=event.id,
                                event_contributor_id=ec.id,
                                contributor_id=contributor.id,
                                amount=amount,
                                currency_id=event.currency_id,
                                payment_method=pm,
                                created_at=now,
                                updated_at=now,
                            ))
                        except Exception as e:
                            errors.append({"row": row_num, "message": f"Payment record failed: {e}"})
                            failure_count += 1
                            continue

                success_count += 1
            except Exception as e:  # pragma: no cover
                errors.append({"row": row_num, "message": str(e)})
                failure_count += 1
            finally:
                # Periodic progress checkpoint
                if (idx + 1) % 25 == 0:
                    job.processed_rows = idx + 1
                    job.successful_rows = success_count
                    job.failed_rows = failure_count
                    job.errors = errors
                    db.commit()

        db.commit()

        job.processed_rows = len(rows)
        job.successful_rows = success_count
        job.failed_rows = failure_count
        job.errors = errors
        job.finished_at = datetime.utcnow()
        if failure_count == 0:
            job.status = "completed"
        elif success_count == 0:
            job.status = "failed"
            job.error_message = "All rows failed"
        else:
            job.status = "partially_completed"
        db.commit()

        return {
            "ok": True,
            "status": job.status,
            "total": len(rows),
            "successful": success_count,
            "failed": failure_count,
        }
    except Exception as e:  # pragma: no cover
        try:
            db.rollback()
            job = (
                db.query(ContributorImportJob)
                .filter(ContributorImportJob.id == uuid.UUID(str(job_id)))
                .first()
            )
            if job:
                job.status = "failed"
                job.error_message = str(e)[:1000]
                job.finished_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()
