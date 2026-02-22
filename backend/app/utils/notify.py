# Notification helper - creates in-app notifications
# Usage: create_notification(db, recipient_id, sender_id, type, message, reference_id, reference_type)

import uuid
from datetime import datetime
import pytz
from models import Notification
from models.enums import NotificationTypeEnum

EAT = pytz.timezone("Africa/Nairobi")


def create_notification(
    db,
    recipient_id,
    sender_id=None,
    notification_type: str = "general",
    message: str = "",
    reference_id=None,
    reference_type: str = None,
    message_data: dict = None,
):
    """
    Creates an in-app notification for a user.
    notification_type should match NotificationTypeEnum values.
    """
    # Skip if recipient is the sender
    if sender_id and str(recipient_id) == str(sender_id):
        return None

    try:
        n_type = NotificationTypeEnum(notification_type)
    except (ValueError, KeyError):
        n_type = NotificationTypeEnum.general if hasattr(NotificationTypeEnum, 'general') else list(NotificationTypeEnum)[0]

    now = datetime.now(EAT)
    notification = Notification(
        id=uuid.uuid4(),
        recipient_id=recipient_id,
        sender_ids=[str(sender_id)] if sender_id else [],
        type=n_type,
        message_template=message,
        message_data=message_data or {},
        reference_id=reference_id if reference_id else None,
        reference_type=reference_type,
        is_read=False,
        created_at=now,
    )
    db.add(notification)
    return notification


def notify_event_invitation(db, recipient_id, sender_id, event_id, event_title):
    """Notify user they've been invited to an event."""
    return create_notification(
        db, recipient_id, sender_id,
        "event_invite",
        f"invited you to {event_title}",
        reference_id=event_id,
        reference_type="event",
        message_data={"event_title": event_title},
    )


def notify_committee_invite(db, recipient_id, sender_id, event_id, event_title, role):
    """Notify user they've been added to an event committee."""
    return create_notification(
        db, recipient_id, sender_id,
        "committee_invite",
        f"added you as {role} for {event_title}",
        reference_id=event_id,
        reference_type="event",
        message_data={"event_title": event_title, "role": role},
    )


def notify_contribution(db, recipient_id, sender_id, event_id, event_title, amount, currency="TZS"):
    """Notify event owner about a contribution."""
    return create_notification(
        db, recipient_id, sender_id,
        "contribution_received",
        f"contributed {currency} {amount:,.0f} to {event_title}",
        reference_id=event_id,
        reference_type="event",
        message_data={"event_title": event_title, "amount": float(amount), "currency": currency},
    )


def notify_glow(db, recipient_id, sender_id, post_id, sender_name):
    """Notify user someone glowed their post."""
    return create_notification(
        db, recipient_id, sender_id,
        "glow",
        "glowed your post",
        reference_id=post_id,
        reference_type="post",
        message_data={"sender_name": sender_name},
    )


def notify_comment(db, recipient_id, sender_id, post_id, sender_name, comment_preview=""):
    """Notify user someone commented on their post."""
    return create_notification(
        db, recipient_id, sender_id,
        "comment",
        f'echoed on your post: "{comment_preview[:50]}"' if comment_preview else "echoed on your post",
        reference_id=post_id,
        reference_type="post",
        message_data={"sender_name": sender_name, "comment": comment_preview[:100]},
    )


def notify_follow(db, recipient_id, sender_id, sender_name):
    """Notify user someone followed them."""
    return create_notification(
        db, recipient_id, sender_id,
        "follow",
        "started following you",
        reference_type="user",
        message_data={"sender_name": sender_name},
    )


def notify_booking(db, recipient_id, sender_id, event_id, event_title, service_name):
    """Notify service provider they've been booked for an event."""
    return create_notification(
        db, recipient_id, sender_id,
        "booking_request",
        f"booked your {service_name} service for {event_title}",
        reference_id=event_id,
        reference_type="event",
        message_data={"event_title": event_title, "service_name": service_name},
    )


def notify_booking_accepted(db, recipient_id, sender_id, event_id, event_title, service_name):
    """Notify event organizer their booking was accepted."""
    return create_notification(
        db, recipient_id, sender_id,
        "booking_accepted",
        f"accepted your booking for {service_name} at {event_title}",
        reference_id=event_id,
        reference_type="event",
        message_data={"event_title": event_title, "service_name": service_name},
    )


def notify_circle_add(db, recipient_id, sender_id, sender_name):
    """Notify user someone added them to their circle."""
    return create_notification(
        db, recipient_id, sender_id,
        "circle_add",
        "added you to their circle",
        reference_type="circle",
        message_data={"sender_name": sender_name},
    )


def notify_circle_request(db, recipient_id, sender_id, sender_name):
    """Notify user someone wants to add them to their circle."""
    return create_notification(
        db, recipient_id, sender_id,
        "circle_request",
        "would like to add you to their circle",
        reference_type="circle_request",
        message_data={"sender_name": sender_name},
    )


def notify_circle_accepted(db, recipient_id, sender_id, sender_name):
    """Notify requester that their circle request was accepted."""
    return create_notification(
        db, recipient_id, sender_id,
        "circle_accepted",
        "accepted your circle request",
        reference_type="circle",
        message_data={"sender_name": sender_name},
    )
