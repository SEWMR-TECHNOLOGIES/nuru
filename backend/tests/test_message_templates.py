"""Tests for the notification message catalogue.

Run with: ``pytest backend/tests/test_message_templates.py -q``
"""
import os
import sys
from datetime import datetime

import pytest

HERE = os.path.dirname(__file__)
APP = os.path.abspath(os.path.join(HERE, "..", "app"))
if APP not in sys.path:
    sys.path.insert(0, APP)

from utils.message_templates import (  # noqa: E402
    TEMPLATES,
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    render_message,
    resolve_user_language,
)
from utils.datetime_format import format_event_datetime  # noqa: E402


# ---- catalogue integrity ---------------------------------------------------

EXPECTED_KEYS = {
    "guest_invitation", "committee_invite", "welcome_registered_by",
    "meeting_invitation", "contribution_recorded_with_balance",
    "contribution_recorded_pledge_complete", "contribution_pledge_set",
    "contribution_thank_you", "guest_contribution_invite",
    "guest_contribution_receipt", "payment_received_generic",
    "payment_confirmation_payer", "organiser_contribution_received",
    "vendor_booking_paid", "admin_payment_alert", "vendor_otp_claim",
    "vendor_otp_resend", "vendor_confirmation_receipt",
    "vendor_confirmation_receipt_full",
    "organiser_committee_vendor_confirmed", "expense_recorded",
    "owner_expense_summary",
    "service_booking_notification", "booking_accepted",
}


def test_all_23_keys_present():
    assert set(TEMPLATES.keys()) == EXPECTED_KEYS


def test_every_template_has_sw_and_en_body():
    for key, languages in TEMPLATES.items():
        for lang in SUPPORTED_LANGUAGES:
            assert lang in languages, f"{key} missing {lang}"
            assert languages[lang]["title"], f"{key}/{lang} blank title"
            assert languages[lang]["body"], f"{key}/{lang} blank body"
            assert "Plan Smarter. Celebrate Better." in languages[lang]["body"], (
                f"{key}/{lang} missing sign-off"
            )


# ---- rendering -------------------------------------------------------------


def test_default_language_is_swahili():
    out = render_message(
        "guest_invitation",
        None,
        guest_name="Asha",
        organizer_name="Juma",
        event_name="Harusi",
        event_date_and_time="Jumamosi, 14 Juni 2026 Saa 18:30",
        event_venue="White Sands",
        rsvp_url="https://nuru.tz/r/abc",
    )
    assert out["title"] == "MWALIKO"
    assert out["body"].startswith("Habari Asha,")
    assert "Plan Smarter. Celebrate Better." in out["body"]


def test_english_when_requested():
    out = render_message(
        "guest_invitation",
        "en",
        guest_name="Asha",
        organizer_name="Juma",
        event_name="Wedding",
        event_date_and_time="Saturday, 14 June 2026 at 18:30",
        event_venue="White Sands",
        rsvp_url="https://nuru.tz/r/abc",
    )
    assert out["title"] == "INVITATION"
    assert out["body"].startswith("Hello Asha,")


def test_unknown_language_falls_back_to_swahili():
    out = render_message("vendor_otp_claim", "fr", code="123456", minutes=10)
    assert out["title"] == "THIBITISHA MALIPO"


def test_missing_placeholder_renders_empty_not_keyerror():
    out = render_message("vendor_otp_resend", "en")  # no placeholders at all
    # Should not raise. Placeholders become empty strings.
    assert out["title"] == "PAYMENT CODE"
    assert "Plan Smarter" in out["body"]


def test_unknown_key_raises():
    with pytest.raises(KeyError):
        render_message("not_a_real_key", "sw")


# ---- date formatting -------------------------------------------------------


def test_sw_datetime_format():
    dt = datetime(2026, 5, 13, 13, 30)  # Wednesday
    out = format_event_datetime(dt, "sw", tz_name=None)
    assert out == "Jumatano, 13 Mei 2026 Saa 13:30"


def test_en_datetime_format():
    dt = datetime(2026, 5, 13, 13, 30)
    out = format_event_datetime(dt, "en", tz_name=None)
    assert out == "Wednesday, 13 May 2026 at 13:30"


def test_datetime_missing_returns_empty_string():
    assert format_event_datetime(None, "sw") == ""


# ---- resolve_user_language: in-memory stub ---------------------------------


class _FakeQuery:
    def __init__(self, row):
        self._row = row

    def filter(self, *_a, **_k):
        return self

    def first(self):
        return self._row


class _FakeSession:
    def __init__(self, row):
        self._row = row

    def query(self, _model):
        return _FakeQuery(self._row)


class _Row:
    def __init__(self, value):
        self.notification_language = value


def test_resolve_defaults_to_swahili_when_no_row():
    db = _FakeSession(None)
    assert resolve_user_language(db, "any-id") == "sw"


def test_resolve_returns_english_when_set():
    db = _FakeSession(_Row("en"))
    assert resolve_user_language(db, "any-id") == "en"


def test_resolve_falls_back_when_value_unrecognised():
    db = _FakeSession(_Row("xx"))
    assert resolve_user_language(db, "any-id") == "sw"


def test_resolve_no_user_id_returns_default():
    assert resolve_user_language(_FakeSession(None), None) == DEFAULT_LANGUAGE
