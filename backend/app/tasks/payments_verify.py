"""
Task: Verify pending payment transactions
==========================================
Re-polls the gateway for any non-terminal mobile-money transactions older
than VERIFY_AFTER_SECONDS (currently driven by /payments/verify-pending) and
promotes them to paid/failed.

This replaces the need for an external cron hitting the HTTP endpoint when
running on the VPS — Celery beat fires it on a schedule.

Also sweeps expired ticket reservations (rows past `reserved_until` that
were never paid for) so seat inventory is freed promptly.
"""
import asyncio
from datetime import datetime, timedelta

from core.celery_app import celery_app
from core.database import SessionLocal


@celery_app.task(
    name="tasks.payments_verify.verify_pending_transactions",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def verify_pending_transactions(self, limit: int = 100):
    """Re-poll the gateway for stale pending transactions.

    Mirrors the logic of ``POST /payments/verify-pending`` but runs in a
    Celery worker so it doesn't depend on an external cron pinging HTTP.
    """
    # Imported lazily to avoid circular imports at worker boot.
    from models.transactions import Transaction, MobilePaymentAttempt
    from models.enums import TransactionStatusEnum
    from services.payment_gateway import gateway
    from api.routes.payments import (
        VERIFY_AFTER_SECONDS,
        VERIFY_MAX_AGE_HOURS,
        _NON_TERMINAL,
        _try_credit_beneficiary,
        _sync_target_after_payment,
        _notify_payment_received,
        _clean_failure_reason,
        _failure_reason_from_callbacks,
    )

    db = SessionLocal()
    try:
        cutoff_old = datetime.utcnow() - timedelta(seconds=VERIFY_AFTER_SECONDS)
        cutoff_max = datetime.utcnow() - timedelta(hours=VERIFY_MAX_AGE_HOURS)

        txs = (
            db.query(Transaction)
            .filter(
                Transaction.status.in_(_NON_TERMINAL),
                Transaction.created_at <= cutoff_old,
                Transaction.created_at >= cutoff_max,
            )
            .order_by(Transaction.created_at.asc())
            .limit(limit)
            .all()
        )

        checked = promoted = failed = 0
        loop = asyncio.new_event_loop()
        try:
            for tx in txs:
                attempt = (
                    db.query(MobilePaymentAttempt)
                    .filter(MobilePaymentAttempt.transaction_id == tx.id)
                    .order_by(MobilePaymentAttempt.created_at.desc())
                    .first()
                )
                if not attempt or not attempt.checkout_request_id:
                    continue
                try:
                    gw_status, gw_reason = loop.run_until_complete(
                        gateway.check_transaction_status_detail(
                            attempt.checkout_request_id
                        )
                    )
                except Exception as e:  # gateway hiccup — try again next tick
                    print(f"[verify-pending-task] gateway error for "
                          f"{tx.transaction_code}: {e}")
                    continue

                checked += 1
                now = datetime.utcnow()
                if gw_status == "PAID":
                    attempt.status = "paid"
                    tx.status = TransactionStatusEnum.paid
                    tx.confirmed_at = now
                    tx.failure_reason = None
                    # _try_credit_beneficiary is async in the route version
                    try:
                        loop.run_until_complete(_try_credit_beneficiary(db, tx))
                    except TypeError:
                        # Fallback if it's actually sync.
                        _try_credit_beneficiary(db, tx)
                    _sync_target_after_payment(db, tx)
                    tx.status = TransactionStatusEnum.credited
                    tx.completed_at = now
                    try:
                        _notify_payment_received(db, tx)
                    except Exception as e:
                        print(f"[verify-pending-task] notify failed for "
                              f"{tx.transaction_code}: {e}")
                    promoted += 1
                elif gw_status == "FAILED":
                    attempt.status = "failed"
                    tx.status = TransactionStatusEnum.failed
                    tx.failure_reason = (
                        _clean_failure_reason(gw_reason)
                        or _failure_reason_from_callbacks(db, tx, attempt)
                        or "Gateway reported failure (no reason returned)."
                    )
                    failed += 1
                # else: still in flight — leave alone
                db.commit()
        finally:
            loop.close()

        return {"checked": checked, "promoted": promoted, "failed": failed}
    except Exception as exc:  # noqa: BLE001
        try:
            db.rollback()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(
    name="tasks.payments_verify.sweep_expired_ticket_reservations",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def sweep_expired_ticket_reservations(self):
    """Hard-delete ticket reservations past their `reserved_until` so
    seat inventory is freed for other buyers."""
    from models.tickets import EventTicket
    from models.enums import TicketOrderStatusEnum

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        deleted = (
            db.query(EventTicket)
            .filter(
                EventTicket.status == TicketOrderStatusEnum.reserved,
                EventTicket.reserved_until.isnot(None),
                EventTicket.reserved_until < now,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return {"deleted": int(deleted)}
    except Exception as exc:  # noqa: BLE001
        try:
            db.rollback()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()
