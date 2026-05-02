"""Map notification types to user-facing push notification titles."""

_TITLES = {
    "message": "New message",
    "event_invite": "Event invitation",
    "committee_invite": "Committee invitation",
    "contribution_received": "New contribution",
    "rsvp_update": "RSVP update",
    "booking_request": "New booking request",
    "booking_accepted": "Booking accepted",
    "booking_rejected": "Booking declined",
    "follow": "New follower",
    "circle_add": "Added to a circle",
    "circle_request": "Circle request",
    "circle_accepted": "Circle accepted",
    "glow": "Someone glowed your post",
    "comment": "New comment",
    "payment": "Payment update",
    "payment_received": "Payment received",
    "payment_failed": "Payment failed",
    "withdrawal": "Withdrawal update",
    "ticket": "Ticket update",
    "security": "Security alert",
    "general": "Nuru",
}


def title_for_notification(ntype: str, data: dict | None = None) -> str:
    if not ntype:
        return "Nuru"
    if ntype in _TITLES:
        return _TITLES[ntype]
    # Try a humanised fallback (snake_case → Title Case).
    return ntype.replace("_", " ").strip().capitalize() or "Nuru"
