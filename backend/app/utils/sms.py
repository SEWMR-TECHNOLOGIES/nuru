# SMS notification helpers using SewmrSmsClient
# Sends SMS for key event lifecycle actions
# Copy aligned with Nuru Copywriting Master Document

from services.SewmrSmsClient import SewmrSmsClient


SMS_SIGNATURE = "\n— Nuru: Keep your event together"


def _send(phone: str, message: str):
    """Fire-and-forget SMS. Appends Nuru signature and logs errors but never raises."""
    if not phone:
        return
    try:
        client = SewmrSmsClient()
        client.send_quick_sms(message=message + SMS_SIGNATURE, recipients=[phone])
    except Exception as e:
        print(f"[SMS] Failed to send to {phone}: {e}")


def sms_guest_added(phone: str, guest_name: str, event_title: str, event_date: str = "", organizer_name: str = "", invitation_code: str = ""):
    """Notify guest they've been invited to an event."""
    msg = f"Hello {guest_name}, you're invited to {event_title}"
    if event_date:
        msg += f" on {event_date}"
    if organizer_name:
        msg += f", hosted by {organizer_name}"
    msg += "."
    if invitation_code:
        msg += f" Please confirm your attendance: https://nuru.tz/rsvp/{invitation_code}"
    else:
        msg += " Open Nuru for details."
    _send(phone, msg)


def sms_committee_invite(phone: str, member_name: str, event_title: str, role: str, organizer_name: str = "", custom_message: str = ""):
    """Notify user they've been added to event committee."""
    msg = f"Hello {member_name}, you've been added as {role} for {event_title}"
    if organizer_name:
        msg += f" by {organizer_name}"
    msg += "."
    if custom_message:
        msg += f" {custom_message}"
    msg += " Open Nuru to see what needs your attention."
    _send(phone, msg)


def sms_contribution_recorded(phone: str, contributor_name: str, event_title: str, amount: float, target: float, total_paid: float, currency: str = "TZS", organizer_phone: str = None, recorder_name: str = None):
    """Notify contributor that their payment has been recorded."""
    balance = max(0, target - total_paid)
    if recorder_name:
        msg = (
            f"Hello {contributor_name}, {recorder_name} has recorded your contribution of {currency} {amount:,.0f} "
            f"for {event_title}. "
        )
    else:
        msg = (
            f"Hello {contributor_name}, your contribution of {currency} {amount:,.0f} "
            f"for {event_title} has been recorded. "
        )
    if target > 0:
        msg += f"Target: {currency} {target:,.0f}, Paid: {currency} {total_paid:,.0f}, Balance: {currency} {balance:,.0f}."
    else:
        msg += f"Total paid: {currency} {total_paid:,.0f}."
    if organizer_phone:
        msg += f" For inquiries, contact the organizer at {organizer_phone}."
    _send(phone, msg)


def sms_contribution_target_set(phone: str, contributor_name: str, event_title: str, target: float, total_paid: float = 0, currency: str = "TZS", organizer_phone: str = None):
    """Notify contributor when a pledge target is set or updated."""
    balance = max(0, target - total_paid)
    msg = (
        f"Hello {contributor_name}, your expected contribution for {event_title} "
        f"is {currency} {target:,.0f}. "
    )
    if total_paid > 0:
        msg += f"Paid so far: {currency} {total_paid:,.0f}. Still pending: {currency} {balance:,.0f}."
    else:
        msg += f"Your contribution is still pending."
    if organizer_phone:
        msg += f" For inquiries, contact the organizer at {organizer_phone}."
    _send(phone, msg)


def sms_thank_you(phone: str, contributor_name: str, event_title: str, custom_message: str = "", organizer_phone: str = None):
    """Send thank you SMS to contributor."""
    msg = f"Hello {contributor_name}, thank you for your contribution to {event_title}."
    if custom_message:
        msg += f" {custom_message}"
    if organizer_phone:
        msg += f" For inquiries, contact the organizer at {organizer_phone}."
    _send(phone, msg)


def sms_booking_notification(phone: str, provider_name: str, event_title: str, client_name: str):
    """Notify service provider they've been booked for an event."""
    msg = (
        f"Hello {provider_name}, {client_name} has booked your service for {event_title}. "
        f"Open Nuru to see the details."
    )
    _send(phone, msg)


def sms_welcome_registered(phone: str, new_user_name: str, registered_by_name: str, password: str):
    """Send welcome SMS to a user registered by someone else (inline registration)."""
    msg = (
        f"Hello {new_user_name}, {registered_by_name} has added you to Nuru, "
        f"the clearer way to organize events. "
        f"Your login password is: {password} . "
        f"Get started at https://nuru.tz"
    )
    _send(phone, msg)


def sms_meeting_invitation(phone: str, event_name: str, meeting_title: str, scheduled_time: str, meeting_link: str):
    """Notify participant about an upcoming meeting via SMS."""
    msg = (
        f"You've been invited to a meeting for {event_name}: {meeting_title}, "
        f"scheduled for {scheduled_time}. "
        f"Join here: {meeting_link}"
    )
    _send(phone, msg)
