# utils/whatsapp_check.py
# DEPRECATED: Active WhatsApp probing is disabled platform-wide.
#
# We never send hello_world (or any silent probe) to detect WhatsApp
# availability. Availability is learned opportunistically from real
# Nuru sends (OTPs, invitations, contribution receipts, pledge reminders,
# thank-you cards, meeting invites, vendor / booking notifications, etc.)
# via `utils.whatsapp_availability.record_send_outcome`.
#
# This stub is kept only so legacy imports don't break.


def check_whatsapp_number(phone: str):  # noqa: ARG001
    """Always returns None — probing is disabled."""
    return None
