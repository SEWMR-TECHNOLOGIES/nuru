# SMS notification helpers using SewmrSmsClient
# Sends SMS for key event lifecycle actions

from services.SewmrSmsClient import SewmrSmsClient


def _send(phone: str, message: str):
    """Fire-and-forget SMS. Logs errors but never raises."""
    if not phone:
        return
    try:
        client = SewmrSmsClient()
        client.send_quick_sms(message=message, recipients=[phone])
    except Exception as e:
        print(f"[SMS] Failed to send to {phone}: {e}")


def sms_guest_added(phone: str, guest_name: str, event_title: str, event_date: str = "", organizer_name: str = ""):
    """Notify guest they've been added to an event."""
    msg = f"Hello {guest_name}, you have been invited to {event_title}"
    if event_date:
        msg += f" on {event_date}"
    if organizer_name:
        msg += f" by {organizer_name}"
    msg += ". Open Nuru app for details."
    _send(phone, msg)


def sms_committee_invite(phone: str, member_name: str, event_title: str, role: str, organizer_name: str = ""):
    """Notify user they've been added to event committee."""
    msg = f"Hello {member_name}, you have been added as {role} for {event_title}"
    if organizer_name:
        msg += f" by {organizer_name}"
    msg += ". Open Nuru app to view your responsibilities."
    _send(phone, msg)


def sms_contribution_recorded(phone: str, contributor_name: str, event_title: str, amount: float, target: float, total_paid: float, currency: str = "TZS"):
    """Notify contributor that their payment has been recorded."""
    balance = max(0, target - total_paid)
    msg = (
        f"Hello {contributor_name}, your contribution of {currency} {amount:,.0f} "
        f"to {event_title} has been recorded. "
        f"Target: {currency} {target:,.0f}, Paid: {currency} {total_paid:,.0f}, "
        f"Balance: {currency} {balance:,.0f}."
    )
    _send(phone, msg)


def sms_contribution_target_set(phone: str, contributor_name: str, event_title: str, target: float, total_paid: float = 0, currency: str = "TZS"):
    """Notify contributors when a pledge target is set."""
    balance = max(0, target - total_paid)
    msg = (
        f"Hello {contributor_name}, a contribution target of {currency} {target:,.0f} "
        f"has been set for {event_title}. "
        f"Your total paid: {currency} {total_paid:,.0f}, Balance: {currency} {balance:,.0f}."
    )
    _send(phone, msg)


def sms_thank_you(phone: str, contributor_name: str, event_title: str, custom_message: str = ""):
    """Send thank you SMS to contributor."""
    msg = f"Hello {contributor_name}, thank you for your contribution to {event_title}."
    if custom_message:
        msg += f" {custom_message}"
    _send(phone, msg)


def sms_booking_notification(phone: str, provider_name: str, event_title: str, client_name: str):
    """Notify service provider they've been booked for an event."""
    msg = (
        f"Hello {provider_name}, you have been booked for {event_title} "
        f"by {client_name}. Open Nuru app for details."
    )
    _send(phone, msg)
