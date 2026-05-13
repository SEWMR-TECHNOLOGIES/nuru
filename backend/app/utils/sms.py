# SMS notification helpers using SewmrSmsClient
# Sends SMS for key event lifecycle actions
# Copy aligned with Nuru Copywriting Master Document

from services.SewmrSmsClient import SewmrSmsClient


SMS_SIGNATURE = "\n— Nuru: Keep your event together"


def normalize_tz_phone(phone: str | None) -> str | None:
    """Normalize a Tanzanian phone to international 255 format.

    Accepts: ``07XXXXXXXX``, ``7XXXXXXXX``, ``+2557XXXXXXXX``, ``2557XXXXXXXX``.
    Returns ``255XXXXXXXXX`` (12 digits) or ``None`` if the input is unusable.
    Gateway rejects local ``07…`` numbers, so we always upgrade to 255 here.
    """
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
    # Already international (KE, etc.) — return as-is.
    return digits


def get_admin_notify_phone(db=None) -> str:
    """Resolve the admin SMS recipient.

    Priority: first active super-admin's stored phone → ``ADMIN_NOTIFY_PHONE``
    env → hard-coded fallback ``255764413610``. Always returns a normalized
    string so callers can SMS without further checks.
    """
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


def _send(phone: str, message: str):
    """Fire-and-forget SMS. Normalizes phone, appends signature, never raises."""
    normalized = normalize_tz_phone(phone)
    if not normalized:
        return
    try:
        client = SewmrSmsClient()
        client.send_quick_sms(message=message + SMS_SIGNATURE, recipients=[normalized])
    except Exception as e:
        print(f"[SMS] Failed to send to {normalized}: {e}")


def sms_guest_added(phone: str, guest_name: str, event_title: str, event_date: str = "", organizer_name: str = "", invitation_code: str = ""):
    """Notify guest they've been invited to an event."""
    msg = f"NURU INVITATION\nHello {guest_name}, you're invited to {event_title}"
    if event_date:
        msg += f" on {event_date}"
    if organizer_name:
        msg += f", hosted by {organizer_name}"
    msg += "."
    if invitation_code:
        msg += f" Please confirm your attendance here: https://nuru.tz/rsvp/{invitation_code}"
    else:
        msg += " Open Nuru for the full details."
    _send(phone, msg)


def sms_committee_invite(phone: str, member_name: str, event_title: str, role: str, organizer_name: str = "", custom_message: str = ""):
    """Notify user they've been added to event committee."""
    msg = f"NURU COMMITTEE\nHello {member_name}, you've been added as {role} for {event_title}"
    if organizer_name:
        msg += f" by {organizer_name}"
    msg += "."
    if custom_message:
        msg += f" {custom_message}"
    msg += " Open Nuru to see what needs your attention."
    _send(phone, msg)


def sms_contribution_recorded(phone: str, contributor_name: str, event_title: str, amount: float, target: float, total_paid: float, currency: str = "TZS", organizer_phone: str = None, recorder_name: str = None):
    """Notify contributor that their contribution has been recorded."""
    balance = max(0, target - total_paid)
    by_bit = f" from {recorder_name}" if recorder_name else ""
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {contributor_name}, we have received your contribution of "
        f"{currency} {amount:,.0f}{by_bit} for {event_title}."
    )
    if target > 0:
        if balance <= 0:
            msg += f" You have completed your pledge of {currency} {target:,.0f}. Thank you!"
        else:
            msg += (
                f" Total paid so far: {currency} {total_paid:,.0f}."
                f" Your remaining pledge is {currency} {balance:,.0f}."
            )
    else:
        msg += f" Total paid so far: {currency} {total_paid:,.0f}."
    if organizer_phone:
        msg += f" For any questions, call the organiser on {organizer_phone}."
    _send(phone, msg)


def sms_contribution_target_set(phone: str, contributor_name: str, event_title: str, target: float, total_paid: float = 0, currency: str = "TZS", organizer_phone: str = None):
    """Notify contributor when a pledge target is set or updated."""
    balance = max(0, target - total_paid)
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {contributor_name}, your expected contribution for {event_title} "
        f"is {currency} {target:,.0f}."
    )
    if total_paid > 0:
        msg += (
            f" You have paid {currency} {total_paid:,.0f} so far,"
            f" your remaining pledge is {currency} {balance:,.0f}."
        )
    else:
        msg += " No payment has been received yet."
    if organizer_phone:
        msg += f" For any questions, call the organiser on {organizer_phone}."
    _send(phone, msg)


def sms_thank_you(phone: str, contributor_name: str, event_title: str, custom_message: str = "", organizer_phone: str = None):
    """Send thank you SMS to contributor."""
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {contributor_name}, thank you for your contribution to {event_title}."
    )
    if custom_message:
        msg += f" {custom_message}"
    if organizer_phone:
        msg += f" For any questions, call the organiser on {organizer_phone}."
    _send(phone, msg)


def sms_booking_notification(phone: str, provider_name: str, event_title: str, client_name: str):
    """Notify service provider they've been booked for an event."""
    msg = (
        f"NURU BOOKING\n"
        f"Hello {provider_name}, {client_name} has just booked your service for "
        f"{event_title}. Open Nuru to review and respond."
    )
    _send(phone, msg)


def sms_welcome_registered(phone: str, new_user_name: str, registered_by_name: str, password: str):
    """Send welcome SMS to a user registered by someone else (inline registration)."""
    msg = (
        f"Hello {new_user_name}, {registered_by_name} has added you to Nuru, "
        f"the easier way to plan and run events together. "
        f"Your login password is: {password}. "
        f"Get started at https://nuru.tz"
    )
    _send(phone, msg)


def sms_meeting_invitation(phone: str, event_name: str, meeting_title: str, scheduled_time: str, meeting_link: str):
    """Notify participant about an upcoming meeting via SMS."""
    msg = (
        f"NURU MEETING\n"
        f"You've been invited to \"{meeting_title}\" for {event_name}, "
        f"scheduled for {scheduled_time}. Join here: {meeting_link}"
    )
    _send(phone, msg)


def sms_payment_received(
    phone: str,
    payer_name: str,
    purpose: str,
    amount: float,
    currency: str,
    transaction_code: str,
    payee_label: str = "your Nuru wallet",
):
    """Notify a user that a payment was successfully received."""
    msg = (
        f"NURU PAYMENT\n"
        f"You have received {currency} {amount:,.0f} from {payer_name} "
        f"for {purpose}. The money is now in {payee_label}. "
        f"Reference: {transaction_code}."
    )
    _send(phone, msg)


def sms_payment_confirmed_to_payer(
    phone: str,
    payer_name: str,
    purpose: str,
    amount: float,
    currency: str,
    transaction_code: str,
):
    """Confirmation back to the person who actually paid."""
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {payer_name}, your payment of {currency} {amount:,.0f} "
        f"for {purpose} was successful. Reference: {transaction_code}. "
        f"Keep this message for your records."
    )
    _send(phone, msg)


def sms_organizer_contribution_received(
    phone: str,
    organizer_name: str,
    contributor_name: str,
    event_title: str,
    amount: float,
    currency: str,
    transaction_code: str,
):
    """Tell an event organizer that a contribution just landed in their wallet."""
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {organizer_name}, you have received a contribution of "
        f"{currency} {amount:,.0f} from {contributor_name} for {event_title}. "
        f"The money is now in your Nuru wallet. Reference: {transaction_code}."
    )
    _send(phone, msg)


def sms_vendor_booking_paid(
    phone: str,
    vendor_name: str,
    client_name: str,
    service_title: str,
    amount: float,
    currency: str,
    transaction_code: str,
):
    """Tell a service vendor that a client just paid for their booking."""
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {vendor_name}, you have received a payment of "
        f"{currency} {amount:,.0f} from {client_name} for your service "
        f"\"{service_title}\". The money is now in your Nuru wallet. "
        f"Reference: {transaction_code}."
    )
    _send(phone, msg)


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
):
    """Heads-up to ops/admin so they can credit/reconcile externally if needed."""
    payer_bit = payer_name + (f" ({payer_phone})" if payer_phone else "")
    target_bit = f" → {target_label}" if target_label else ""
    method_bit = f" via {method}" if method else ""
    msg = (
        f"[Nuru Admin] {currency} {amount:,.0f} received{method_bit} for "
        f"{purpose}{target_bit} from {payer_bit}. Ref: {transaction_code}."
    )
    _send(phone, msg)


def sms_guest_contribution_invite(
    phone: str,
    contributor_name: str,
    organiser_name: str,
    event_title: str,
    pledge_amount: float,
    currency: str,
    payment_url: str,
):
    """Invite a non-Nuru-user contributor to pay their pledge via a link.

    Friendly, no jargon — recipient may have never heard of Nuru before.
    """
    amount_bit = (
        f"{currency} {pledge_amount:,.0f}" if pledge_amount and pledge_amount > 0 else "your contribution"
    )
    msg = (
        f"NURU CONTRIBUTION\n"
        f"Hello {contributor_name}, {organiser_name} has invited you to contribute "
        f"{amount_bit} towards {event_title}. "
        f"You can pay securely here: {payment_url}"
    )
    _send(phone, msg)


def sms_guest_contribution_receipt(
    phone: str,
    contributor_name: str,
    event_title: str,
    amount: float,
    currency: str,
    transaction_code: str,
    receipt_url: str,
):
    """Send a guest contributor a link to their permanent receipt page.

    Fired once when a guest payment transitions to credited on the public
    flow. Recipient may not have a Nuru account — keep it plain.
    """
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {contributor_name}, thank you! Your payment of "
        f"{currency} {amount:,.0f} for {event_title} was successful. "
        f"Reference: {transaction_code}. View your receipt anytime: {receipt_url}"
    )
    _send(phone, msg)


