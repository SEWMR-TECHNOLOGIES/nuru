# SMS notification helpers — all wording now comes from
# utils.message_templates so the body text matches the Nuru SMS catalogue
# in Swahili (default) or English (when the recipient opted in).
#
# Call sites kept their existing signatures; pass ``lang="en"`` (or use
# ``resolve_user_language(db, user_id)`` upstream) when the recipient has
# selected English. Anything else falls back to Swahili.

from services.SewmrSmsClient import SewmrSmsClient
from utils.message_templates import render_message, DEFAULT_LANGUAGE, format_money
from utils.datetime_format import format_event_datetime


# Kept for Celery worker compatibility. Catalogue templates already include
# the approved Nuru sign-off, so batch/single workers append an empty suffix.
SMS_SIGNATURE = ""


def normalize_tz_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(c for c in str(phone) if c.isdigit())
    if not digits:
        return None
    if digits.startswith("255") and len(digits) == 12:
        return digits
    if digits.startswith("0") and len(digits) == 10:
        return "255" + digits[1:]
    if len(digits) == 9 and digits.startswith("7"):
        return "255" + digits
    return digits


def get_admin_notify_phone(db=None) -> str:
    from core.config import ADMIN_NOTIFY_PHONE
    if db is not None:
        try:
            from models.admin import AdminUser, AdminRoleEnum
            admin = (
                db.query(AdminUser)
                .filter(
                    AdminUser.is_active == True,  # noqa: E712
                    AdminUser.role.in_([AdminRoleEnum.admin, AdminRoleEnum.finance_admin]),
                )
                .order_by(AdminUser.created_at.asc())
                .first()
            )
            phone = getattr(admin, "phone", None) if admin else None
            normalized = normalize_tz_phone(phone)
            if normalized:
                return normalized
        except Exception as e:
            print(f"[SMS] admin phone lookup failed: {e}")
    return normalize_tz_phone(ADMIN_NOTIFY_PHONE) or "255764413610"


def _send_sync(phone: str, message: str):
    """Synchronous SMS transport. Catalogue bodies already carry the
    ``Plan Smarter. Celebrate Better.`` sign-off, so we no longer append
    a separate signature here."""
    normalized = normalize_tz_phone(phone)
    if not normalized:
        return
    try:
        client = SewmrSmsClient()
        client.send_quick_sms(message=message, recipients=[normalized])
    except Exception as e:
        print(f"[SMS] Failed to send to {normalized}: {e}")


def _send(phone: str, message: str):
    if not phone:
        return
    try:
        from core.celery_app import CELERY_ENABLED
    except Exception:
        CELERY_ENABLED = False
    if CELERY_ENABLED:
        try:
            from tasks.sms_dispatch import send_one
            send_one.delay(phone, message)
            return
        except Exception as e:
            print(f"[SMS] enqueue failed, sending inline: {e}")
    _send_sync(phone, message)


def _render_and_send(phone: str, key: str, lang: str | None, **params) -> None:
    if not phone:
        return
    msg = render_message(key, lang or DEFAULT_LANGUAGE, **params)
    _send(phone, msg["body"])


def default_custom_message(lang: str | None) -> str:
    """Fallback ``custom_message`` used when the sender leaves it blank.
    Templates with a ``{custom_message}`` placeholder must never render an
    empty slot, so we substitute a neutral thank-you line in the recipient's
    language (Swahili by default)."""
    return "Thank you for your generosity." if (lang or DEFAULT_LANGUAGE).lower() == "en" else "Tunakushukuru kwa ukarimu wako."



# ──────────────────────────────────────────────
# Catalogue-backed helpers (signature-compatible with prior versions)
# ──────────────────────────────────────────────

def sms_guest_added(
    phone: str,
    guest_name: str,
    event_title: str,
    event_date: str = "",
    organizer_name: str = "",
    invitation_code: str = "",
    *,
    event_venue: str = "",
    lang: str | None = None,
):
    rsvp_url = f"https://nuru.tz/rsvp/{invitation_code}" if invitation_code else ""
    _render_and_send(
        phone,
        "guest_invitation",
        lang,
        guest_name=guest_name,
        organizer_name=organizer_name,
        event_name=event_title,
        event_date_and_time=event_date,
        event_venue=event_venue,
        rsvp_url=rsvp_url,
        # Suffix for the dynamic URL button on the Meta template
        # `nuru_guest_invitation_{sw,en}` (static prefix: https://nuru.tz/rsvp/).
        rsvp_code=invitation_code or "",
    )


def sms_committee_invite(
    phone: str,
    member_name: str,
    event_title: str,
    role: str,
    organizer_name: str = "",
    custom_message: str = "",
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "committee_invite",
        lang,
        member_name=member_name,
        organizer_name=organizer_name,
        role=role,
        event_name=event_title,
        custom_message=custom_message or default_custom_message(lang),
    )


def _fmt_money(amount: float | int | None) -> str:
    try:
        return f"{float(amount or 0):,.0f}"
    except Exception:
        return str(amount or "")


def sms_contribution_recorded(
    phone: str,
    contributor_name: str,
    event_title: str,
    amount: float,
    target: float,
    total_paid: float,
    currency: str = "TZS",
    organizer_phone: str = None,
    recorder_name: str = None,
    *,
    lang: str | None = None,
):
    balance = max(0, (target or 0) - (total_paid or 0))
    if target and balance <= 0:
        key = "contribution_recorded_pledge_complete"
    else:
        key = "contribution_recorded_with_balance"
    _render_and_send(
        phone,
        key,
        lang,
        contributor_name=contributor_name,
        recorder_name=recorder_name or "",
        amount_text=format_money(currency, amount),
        event_name=event_title,
        total_paid_text=format_money(currency, total_paid),
        balance_text=format_money(currency, balance),
        target_text=format_money(currency, target),
        organizer_phone=organizer_phone or "",
    )


def sms_contribution_target_set(
    phone: str,
    contributor_name: str,
    event_title: str,
    target: float,
    total_paid: float = 0,  # accepted for backwards compat, intentionally unused
    currency: str = "TZS",
    organizer_phone: str = None,
    *,
    lang: str | None = None,
    payment_instructions: str | None = None,
):
    """First-time pledge assignment. Does NOT include total_paid or balance."""
    from utils.payment_instructions import resolve_payment_instructions
    instr = (payment_instructions or "").strip() or resolve_payment_instructions(None, lang)
    _render_and_send(
        phone,
        "contribution_target_set",
        lang,
        contributor_name=contributor_name,
        event_name=event_title,
        target_text=format_money(currency, target),
        organizer_phone=organizer_phone or "",
        payment_instructions=instr,
    )


def sms_contribution_target_updated(
    phone: str,
    contributor_name: str,
    event_title: str,
    increase: float,
    total_target: float,
    currency: str = "TZS",
    organizer_phone: str = None,
    *,
    lang: str | None = None,
    payment_instructions: str | None = None,
):
    """Pledge increased on an existing pledge.

    NOTE: Pledge reductions (new_target < old_target) fall back to
    ``sms_contribution_target_set`` at the call site. There is no
    dedicated reduction template yet.
    """
    from utils.payment_instructions import resolve_payment_instructions
    instr = (payment_instructions or "").strip() or resolve_payment_instructions(None, lang)
    _render_and_send(
        phone,
        "contribution_target_updated",
        lang,
        contributor_name=contributor_name,
        event_name=event_title,
        increase_text=format_money(currency, increase),
        total_target_text=format_money(currency, total_target),
        organizer_phone=organizer_phone or "",
        payment_instructions=instr,
    )


def sms_thank_you(
    phone: str,
    contributor_name: str,
    event_title: str,
    custom_message: str = "",
    organizer_phone: str = None,
    total_paid: float = 0,
    currency: str = "TZS",
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "contribution_thank_you",
        lang,
        contributor_name=contributor_name,
        event_name=event_title,
        amount_text=format_money(currency, total_paid or 0),
        custom_message=custom_message or default_custom_message(lang),
        organizer_phone=organizer_phone or "",
    )


def sms_booking_notification(
    phone: str,
    provider_name: str,
    event_title: str,
    client_name: str,
    service_name: str = "service",
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "service_booking_notification",
        lang,
        provider_name=provider_name,
        client_name=client_name,
        service_name=service_name or "service",
        event_name=event_title,
    )


def sms_welcome_registered(
    phone: str,
    new_user_name: str,
    registered_by_name: str,
    setup_url: str,
    *,
    lang: str | None = None,
):
    """WhatsApp / link-based welcome — no password in the body."""
    _render_and_send(
        phone,
        "welcome_registered_by",
        lang,
        new_user_name=new_user_name,
        registered_by_name=registered_by_name,
        setup_url=setup_url,
    )


def sms_welcome_registered_with_temp_password(
    phone: str,
    new_user_name: str,
    registered_by_name: str,
    password: str,
    *,
    lang: str | None = None,
):
    """SMS / mobile-only fallback that ships a temporary password and
    flags the account for forced password change on first sign-in."""
    _render_and_send(
        phone,
        "welcome_registered_by_sms",
        lang,
        new_user_name=new_user_name,
        registered_by_name=registered_by_name,
        password=password,
    )


def sms_meeting_invitation(
    phone: str,
    event_name: str,
    meeting_title: str,
    scheduled_time: str,
    meeting_link: str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "meeting_invitation",
        lang,
        meeting_title=meeting_title,
        event_name=event_name,
        scheduled_date_and_time=scheduled_time,
        meeting_link=meeting_link,
    )


def sms_payment_received(
    phone: str,
    payer_name: str,
    purpose: str,
    amount: float,
    currency: str,
    transaction_code: str,
    payee_label: str = "your Nuru wallet",  # accepted for back-compat, no longer rendered
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "payment_received_generic",
        lang,
        amount_text=format_money(currency, amount),
        payer_name=payer_name,
        purpose=purpose,
        transaction_code=transaction_code,
    )


def sms_payment_confirmed_to_payer(
    phone: str,
    payer_name: str,
    purpose: str,
    amount: float,
    currency: str,
    transaction_code: str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "payment_confirmation_payer",
        lang,
        payer_name=payer_name,
        amount_text=format_money(currency, amount),
        purpose=purpose,
        transaction_code=transaction_code,
    )


def sms_organizer_contribution_received(
    phone: str,
    organizer_name: str,
    contributor_name: str,
    event_title: str,
    amount: float,
    currency: str,
    transaction_code: str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "organiser_contribution_received",
        lang,
        organizer_name=organizer_name,
        amount_text=format_money(currency, amount),
        contributor_name=contributor_name,
        event_name=event_title,
        transaction_code=transaction_code,
    )


def sms_vendor_booking_paid(
    phone: str,
    vendor_name: str,
    client_name: str,
    service_title: str,
    amount: float,
    currency: str,
    transaction_code: str,
    service_amount: float = 0,
    total_paid: float = 0,
    balance: float = 0,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "vendor_booking_paid",
        lang,
        vendor_name=vendor_name,
        amount_text=format_money(currency, amount),
        client_name=client_name,
        service_title=service_title,
        service_amount_text=format_money(currency, service_amount),
        total_paid_text=format_money(currency, total_paid),
        balance_text=format_money(currency, balance),
        transaction_code=transaction_code,
    )


def sms_admin_payment_alert(
    phone: str,
    payer_name: str,
    payer_phone: str | None,
    purpose: str,
    amount: float,
    currency: str,
    transaction_code: str,
    method: str | None,
    target_label: str | None = None,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "admin_payment_alert",
        lang,
        amount_text=format_money(currency, amount),
        method=method or "",
        purpose=purpose,
        target_label=target_label or "",
        payer_name=payer_name,
        payer_phone=payer_phone or "",
        transaction_code=transaction_code,
    )


def sms_guest_contribution_invite(
    phone: str,
    contributor_name: str,
    organiser_name: str,
    event_title: str,
    pledge_amount: float,
    currency: str,
    payment_url: str,
    *,
    lang: str | None = None,
):
    # Derive the public-link share token from the payment URL so the
    # edge function can populate the dynamic URL button on Meta template
    # `nuru_guest_contribution_invite_{sw,en}` (static prefix: https://nuru.tz/c/).
    share_token = ""
    if payment_url and "/c/" in payment_url:
        share_token = payment_url.split("/c/", 1)[1].strip("/")
    _render_and_send(
        phone,
        "guest_contribution_invite",
        lang,
        contributor_name=contributor_name,
        organiser_name=organiser_name,
        pledge_amount_text=format_money(currency, pledge_amount),
        event_name=event_title,
        payment_url=payment_url,
        share_token=share_token,
    )


def sms_guest_contribution_receipt(
    phone: str,
    contributor_name: str,
    event_title: str,
    amount: float,
    currency: str,
    transaction_code: str,
    receipt_url: str,
    total_paid: float = 0,
    balance: float = 0,
    *,
    lang: str | None = None,
):
    # Derive the receipt path suffix from the receipt URL so the edge
    # function can populate the dynamic URL button on Meta template
    # `nuru_guest_contribution_receipt_{sw,en}` (static prefix: https://nuru.tz/c/).
    receipt_path = ""
    if receipt_url and "/c/" in receipt_url:
        receipt_path = receipt_url.split("/c/", 1)[1].strip("/")
    _render_and_send(
        phone,
        "guest_contribution_receipt",
        lang,
        contributor_name=contributor_name,
        amount_text=format_money(currency, amount),
        event_name=event_title,
        total_paid_text=format_money(currency, total_paid),
        balance_text=format_money(currency, balance),
        transaction_code=transaction_code,
        receipt_url=receipt_url,
        receipt_path=receipt_path,
    )


# ──────────────────────────────────────────────
# Offline-vendor OTP / confirmation
# ──────────────────────────────────────────────

def sms_vendor_otp_claim(
    phone: str,
    vendor_first_name: str,
    organiser_name: str,
    currency: str,
    amount: float,
    service_title: str,
    event_name: str,
    code: str,
    minutes: int | str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "vendor_otp_claim",
        lang,
        vendor_first_name=vendor_first_name,
        organiser_name=organiser_name,
        amount_text=format_money(currency, amount),
        service_title=service_title,
        event_name=event_name,
        code=code,
        minutes=str(minutes),
    )


def sms_vendor_otp_resend(
    phone: str,
    vendor_first_name: str,
    organiser_name: str,
    currency: str,
    amount: float,
    service_title: str,
    event_name: str,
    code: str,
    minutes: int | str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "vendor_otp_resend",
        lang,
        vendor_first_name=vendor_first_name,
        organiser_name=organiser_name,
        amount_text=format_money(currency, amount),
        service_title=service_title,
        event_name=event_name,
        code=code,
        minutes=str(minutes),
    )


def sms_vendor_confirmation_receipt(
    phone: str,
    vendor_first_name: str,
    organiser_name: str,
    event_name: str,
    currency: str,
    amount: float,
    balance: float,
    *,
    lang: str | None = None,
):
    full = (balance or 0) <= 0
    key = "vendor_confirmation_receipt_full" if full else "vendor_confirmation_receipt"
    _render_and_send(
        phone,
        key,
        lang,
        vendor_first_name=vendor_first_name,
        organiser_name=organiser_name,
        event_name=event_name,
        amount_text=format_money(currency, amount),
        balance_text=format_money(currency, max(0, balance or 0)),
    )


def sms_organiser_committee_vendor_confirmed(
    phone: str,
    recipient_first_name: str,
    vendor_name: str,
    organiser_name: str,
    event_name: str,
    currency: str,
    amount: float,
    balance: float,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "organiser_committee_vendor_confirmed",
        lang,
        recipient_first_name=recipient_first_name,
        vendor_name=vendor_name,
        organiser_name=organiser_name,
        amount_text=format_money(currency, amount),
        event_name=event_name,
        balance_text=format_money(currency, max(0, balance or 0)),
    )


def sms_expense_recorded(
    phone: str,
    recipient_first_name: str,
    recorder_name: str,
    currency: str,
    amount: float,
    category: str,
    event_name: str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "expense_recorded",
        lang,
        recipient_first_name=recipient_first_name,
        recorder_name=recorder_name,
        amount_text=format_money(currency, amount),
        category=category,
        event_name=event_name,
    )


def sms_owner_expense_summary(
    phone: str,
    organizer_name: str,
    event_name: str,
    expense_name: str,
    currency: str,
    expense_amount: float,
    total_budget: float,
    total_expenses: float,
    remaining_balance: float,
    *,
    lang: str | None = None,
):
    """Notify the event owner / creator that an expense was logged, with
    full budget summary (total contributed, total expenses, remaining)."""
    _render_and_send(
        phone,
        "owner_expense_summary",
        lang,
        organizer_name=organizer_name,
        event_name=event_name,
        expense_name=expense_name,
        expense_amount=format_money(currency, expense_amount),
        total_budget=format_money(currency, total_budget),
        total_expenses=format_money(currency, total_expenses),
        remaining_balance=format_money(currency, remaining_balance),
    )
    try:
        from utils.whatsapp import _send_whatsapp
        _send_whatsapp("owner_expense_summary", phone, {
            "organizer_name": organizer_name,
            "event_name": event_name,
            "expense_name": expense_name,
            "expense_amount": format_money(currency, expense_amount),
            "total_budget": format_money(currency, total_budget),
            "total_expenses": format_money(currency, total_expenses),
            "remaining_balance": format_money(currency, remaining_balance),
            "lang": lang or DEFAULT_LANGUAGE,
        })
    except Exception as e:
        print(f"[WhatsApp] owner_expense_summary failed: {e}")


def sms_booking_accepted(
    phone: str,
    requester_first_name: str,
    vendor_name: str,
    service_name: str,
    event_name: str,
    *,
    lang: str | None = None,
):
    _render_and_send(
        phone,
        "booking_accepted",
        lang,
        requester_first_name=requester_first_name,
        vendor_name=vendor_name,
        service_name=service_name,
        event_name=event_name,
    )


# Pledge thank-you card SMS fallback (TZ only — same gating as other SMS).
def sms_pledge_thank_you_card(
    phone: str,
    contributor_name: str,
    event_name: str,
    card_link: str,
    *,
    lang: str | None = None,
):
    L = (lang or "sw").lower()[:2]
    if L == "en":
        body = (
            f"Thank you {contributor_name} for your pledge contribution to {event_name}. "
            f"Open your thank you card here: {card_link}"
        )
    else:
        body = (
            f"Asante {contributor_name} kwa ahadi yako ya mchango kwenye {event_name}. "
            f"Fungua kadi yako ya shukrani hapa: {card_link}"
        )
    try:
        from services.SewmrSmsClient import SewmrSmsClient
        SewmrSmsClient().send(phone, body)
        return True
    except Exception as exc:
        print(f"[sms_pledge_thank_you_card] failed: {exc!r}")
        return False
