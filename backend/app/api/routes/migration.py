"""Legacy-User Migration status endpoint.

GET /users/me/migration-status

Single source of truth used by both the web app (`useMigrationStatus`) and
the Flutter app (`MigrationProvider`). Computes:

  • needs_setup           — true when the user has no completed default
                            payment profile.
  • has_monetized_content — any organized event, listed service, sold ticket,
                            received contribution or booking received.
  • has_pending_balance   — any wallet has pending_balance > 0.
  • monetized_summary     — counts per category for the welcome modal.
  • country_guess         — best-effort {code, source} from existing profile,
                            phone prefix, or null. The frontend can then fall
                            back to IP / locale.
  • pending_balance       — first non-zero wallet, or null.
  • legacy_since          — user's created_at (drives the 14-day escalation
                            clock when the user has monetized content but no
                            payment profile).
"""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import standard_response

from models.users import User, UserProfile
from models.events import Event
from models.services import UserService
from models.bookings import ServiceBookingRequest
from models.ticketing import EventTicket, EventTicketClass
from models.contributions import EventContribution
from models.payments import PaymentProfile, Wallet


router = APIRouter(prefix="/users", tags=["migration"])


def _phone_country(phone: str | None) -> tuple[str | None, str | None]:
    if not phone:
        return None, None
    cleaned = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if cleaned.startswith("+255") or cleaned.startswith("255"):
        return "TZ", "phone"
    if cleaned.startswith("+254") or cleaned.startswith("254"):
        return "KE", "phone"
    return None, None


@router.get("/me/migration-status")
def migration_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    # ── 1. Has completed default payout profile? ────────────────────────────
    has_profile = (
        db.query(PaymentProfile.id)
        .filter(
            PaymentProfile.user_id == user_id,
            PaymentProfile.is_default == True,  # noqa: E712
            PaymentProfile.is_completed == True,  # noqa: E712
        )
        .first()
        is not None
    )

    # ── 2. Monetized content counts ─────────────────────────────────────────
    events_count = (
        db.query(func.count(Event.id))
        .filter(Event.organizer_id == user_id)
        .scalar() or 0
    )
    services_count = (
        db.query(func.count(UserService.id))
        .filter(UserService.user_id == user_id)
        .scalar() or 0
    )
    # Ticketed events the user organized that have at least one ticket class.
    ticketed_events_count = (
        db.query(func.count(func.distinct(Event.id)))
        .join(EventTicketClass, EventTicketClass.event_id == Event.id)
        .filter(Event.organizer_id == user_id)
        .scalar() or 0
    )
    # Contributions received on the user's events.
    contributions_count = (
        db.query(func.count(EventContribution.id))
        .join(Event, Event.id == EventContribution.event_id)
        .filter(Event.organizer_id == user_id)
        .scalar() or 0
    )
    # Bookings received on the user's services.
    bookings_count = (
        db.query(func.count(ServiceBookingRequest.id))
        .join(UserService, UserService.id == ServiceBookingRequest.user_service_id)
        .filter(UserService.user_id == user_id)
        .scalar() or 0
    )

    monetized_summary = {
        "events": int(events_count),
        "services": int(services_count),
        "ticketed_events": int(ticketed_events_count),
        "contributions": int(contributions_count),
        "bookings": int(bookings_count),
    }
    has_monetized_content = sum(monetized_summary.values()) > 0

    # ── 3. Pending balance across wallets ───────────────────────────────────
    pending_wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == user_id, Wallet.pending_balance > 0)
        .order_by(Wallet.pending_balance.desc())
        .first()
    )
    pending_balance = None
    if pending_wallet:
        pending_balance = {
            "amount": float(pending_wallet.pending_balance or Decimal("0")),
            "currency": pending_wallet.currency_code,
        }

    # ── 4. Country guess ────────────────────────────────────────────────────
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    code: str | None = None
    source: str | None = None
    if profile and profile.country_code:
        code = profile.country_code
        source = profile.country_source or "manual"
    if not code:
        code, source = _phone_country(getattr(current_user, "phone", None))

    country_guess = {"code": code, "source": source}

    # ── 5. Legacy-since clock ───────────────────────────────────────────────
    legacy_since = None
    if has_monetized_content and not has_profile:
        created = getattr(current_user, "created_at", None)
        if isinstance(created, datetime):
            legacy_since = created.isoformat()

    payload = {
        "needs_setup": not has_profile,
        "has_monetized_content": has_monetized_content,
        "has_pending_balance": pending_balance is not None,
        "monetized_summary": monetized_summary,
        "country_guess": country_guess,
        "pending_balance": pending_balance,
        "legacy_since": legacy_since,
    }
    return standard_response(True, "Migration status retrieved.", payload)
