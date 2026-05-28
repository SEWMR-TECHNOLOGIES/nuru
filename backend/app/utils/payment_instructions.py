"""Helpers to resolve contributor payment instructions for notifications."""
from __future__ import annotations

from typing import Optional

DEFAULT_EN = "Pay your contribution to the organizer through Nuru securely."
DEFAULT_SW = "Unaweza kutoa mchango wako kupitia Nuru."


def resolve_payment_instructions(event, lang: Optional[str] = None) -> str:
    """Return the event's custom payment instructions or the language fallback.

    Empty string / whitespace is treated as missing.
    """
    custom = getattr(event, "contribution_payment_instructions", None) if event else None
    if custom and str(custom).strip():
        return str(custom).strip()
    code = (lang or "sw").strip().lower()
    return DEFAULT_EN if code == "en" else DEFAULT_SW
