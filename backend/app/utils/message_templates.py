"""Nuru notification message catalogue.

Source of truth: ``nuru_sms_messages_updated.docx`` (Swahili default,
English when the recipient has set ``notification_language = 'en'``).

The bodies below are pasted verbatim from the document — wording,
sign-off, and placeholder names are preserved exactly. Do not
paraphrase. New rules: every message ends with
``Plan Smarter. Celebrate Better.``

API
---
``render_message(key, lang, **placeholders)`` -> ``{"title", "body"}``

    Falls back to Swahili on unknown language. Missing placeholders are
    rendered as ``""`` rather than raising so a single missing field
    never blocks a notification.

``resolve_user_language(db, user_id, fallback='sw')`` -> ``'sw' | 'en'``

    Reads ``UserSetting.notification_language``; defaults to Swahili
    when the user has no row, no preference, or an unrecognised value.
"""
from __future__ import annotations

from typing import Optional


SUPPORTED_LANGUAGES = ("sw", "en")
DEFAULT_LANGUAGE = "sw"
SIGN_OFF = "Plan Smarter. Celebrate Better."


# ---------------------------------------------------------------------------
# Money formatting helper
# ---------------------------------------------------------------------------
#
# Meta WhatsApp template rules:
#   1. A single placeholder number must NOT appear more than once in a body.
#   2. Currency + amount must be sent as ONE pre-formatted string so we never
#      need to reuse a placeholder for the currency code.
#
# All catalogue bodies that show money values use combined placeholders
# (``{amount_text}``, ``{balance_text}``, ``{target_text}``, …) populated
# with the output of ``format_money(currency, amount)``. Backend helpers in
# ``utils/sms.py`` and ``utils/whatsapp.py`` build these once per call site
# and pass them through to both the SMS renderer and the WhatsApp edge
# function dispatcher.

def format_money(currency, amount) -> str:
    """Return a single human-formatted money string, e.g. ``"TZS 10,000"``.

    - Currency code is normalised to upper-case; defaults to ``"TZS"`` when
      missing/blank.
    - Amount is rendered with thousands separators and no decimals (the
      whole-unit convention used across the platform for TZS / KES / UGX).
    - Non-numeric / ``None`` amounts render as ``"<CCY> 0"`` rather than
      crashing — a single missing field must never block a notification.
    """
    code = (str(currency).strip().upper() if currency else "") or "TZS"
    try:
        value = float(amount if amount is not None else 0)
    except (TypeError, ValueError):
        value = 0.0
    return f"{code} {value:,.0f}"


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------
#
# Keys mirror the "Function / Trigger" rows in the document. Each entry has
# a ``sw`` and ``en`` body; titles are uppercase headlines from the doc.
# Placeholders use ``{name}`` Python format syntax.

TEMPLATES: dict[str, dict[str, dict[str, str]]] = {
    # 1
    "guest_invitation": {
        "sw": {
            "title": "MWALIKO",
            "body": (
                "Habari {guest_name}, {organizer_name} amekualika kwenye "
                "{event_name} tarehe {event_date_and_time} {event_venue}. "
                "Tafadhali thibitisha uwepo wako kupitia link hii:\n"
                "{rsvp_url}\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "INVITATION",
            "body": (
                "Hello {guest_name}, {organizer_name} has invited you to "
                "{event_name} on {event_date_and_time} at {event_venue}. "
                "Please confirm your attendance here:\n"
                "{rsvp_url}\n" + SIGN_OFF
            ),
        },
    },
    # 2
    "committee_invite": {
        "sw": {
            "title": "KAMATI YA TUKIO",
            "body": (
                "Habari {member_name}, {organizer_name} amekuchagua kuwa "
                "{role} kwenye {event_name}. {custom_message} Fungua Nuru "
                "kuona majukumu yako na taarifa muhimu za tukio.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "EVENT COMMITTEE",
            "body": (
                "Hello {member_name}, {organizer_name} has added you as "
                "{role} for {event_name}. {custom_message} Open Nuru to "
                "see your tasks and important event updates.\n" + SIGN_OFF
            ),
        },
    },
    # 3
    # 3a — WhatsApp / link-based welcome (no password in body, no OTP)
    "welcome_registered_by": {
        "sw": {
            "title": "KARIBU NURU",
            "body": (
                "Habari {new_user_name},\n\n{registered_by_name} amekusajiri "
                "kwenye Nuru.\n\nAkaunti yako imeundwa kikamilifu. Bonyeza "
                "link hapa chini kuweka nenosiri lako upya\n{setup_url}\n"
                "\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "WELCOME TO NURU",
            "body": (
                "Hello {new_user_name},\n\n{registered_by_name} has added "
                "you to Nuru.\n\nYour account is ready. Open the link below "
                "to securely set your password and sign in to Nuru:\n"
                "{setup_url}\n\nThis link is single-use and expires "
                "shortly.\n" + SIGN_OFF
            ),
        },
    },
    # 3b — SMS / mobile temporary-password fallback (not for WhatsApp)
    "welcome_registered_by_sms": {
        "sw": {
            "title": "KARIBU NURU",
            "body": (
                "Habari {new_user_name},\n\n{registered_by_name} amekusajiri "
                "kwenye Nuru.\n\nTumia namba yako uliyojisajili nayo kuingia.\n"
                "Nenosiri la muda: {password}\n\nKwa usalama, utahitajika "
                "kubadilisha nenosiri hili baada ya kuingia mara ya kwanza."
                "\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "WELCOME TO NURU",
            "body": (
                "Hello {new_user_name},\n\n{registered_by_name} has added "
                "you to Nuru.\n\nUse the phone number you were registered "
                "with to sign in.\nTemporary password: {password}\n\nFor "
                "your security, you will be required to change this "
                "password after your first sign-in.\n" + SIGN_OFF
            ),
        },
    },
    # 4
    "meeting_invitation": {
        "sw": {
            "title": "MWALIKO WA KIKAO",
            "body": (
                "Umealikwa kwenye kikao cha {meeting_title} kwa ajili ya "
                "{event_name}. Kikao kimepangwa kufanyika "
                "{scheduled_date_and_time}. Jiunge hapa: {meeting_link}\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "MEETING INVITATION",
            "body": (
                "You have been invited to {meeting_title} for {event_name}. "
                "The meeting is scheduled for {scheduled_date_and_time}. "
                "Join here: {meeting_link}\n" + SIGN_OFF
            ),
        },
    },
    # 5
    "contribution_recorded_with_balance": {
        "sw": {
            "title": "MALIPO YAMEPOKELEWA",
            "body": (
                "Habari {contributor_name}, tumepokea mchango wako wa "
                "{amount_text} kutoka kwa {recorder_name} kwa ajili ya "
                "{event_name}. Jumla uliyolipa hadi sasa ni "
                "{total_paid_text}. Salio lako ni {balance_text}. Kwa "
                "msaada, mpigie mratibu wa tukio kupitia {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT RECEIVED",
            "body": (
                "Hello {contributor_name}, we have received your "
                "contribution of {amount_text} from {recorder_name} for "
                "{event_name}. You have paid {total_paid_text} so far. "
                "Your remaining balance is {balance_text}. For help, call "
                "the organiser on {organizer_phone}.\n" + SIGN_OFF
            ),
        },
    },
    # 6
    "contribution_recorded_pledge_complete": {
        "sw": {
            "title": "AHADI IMEKAMILIKA",
            "body": (
                "Habari {contributor_name}, tumepokea mchango wako wa "
                "{amount_text} kutoka kwa {recorder_name} kwa ajili ya "
                "{event_name}. Hongera kwa kukamilisha ahadi yako ya "
                "{target_text}. Asante kwa mchago wako muhimu. Kwa msaada, "
                "mpigie mratibu wa tukio kupitia {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "PLEDGE COMPLETED",
            "body": (
                "Hello {contributor_name}, we have received your "
                "contribution of {amount_text} from {recorder_name} for "
                "{event_name}. Congratulations for completing your pledge "
                "of {target_text}. Thank you for your support. For help, "
                "call the organiser on {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 7a - Contribution target SET (first-time pledge assignment)
    "contribution_target_set": {
        "sw": {
            "title": "AHADI YA MCHANGO",
            "body": (
                "Habari {contributor_name}, tumepokea ahadi yako ya mchango "
                "kwa ajili ya {event_name} kiasi cha {target_text}. Asante "
                "kwa ukarimu wako. Kwa msaada, mpigie mratibu wa tukio "
                "kupitia {organizer_phone}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "CONTRIBUTION PLEDGE",
            "body": (
                "Hello {contributor_name}, we have received your "
                "contribution pledge for {event_name} of "
                "{target_text}. Thank you for your generosity. For help, "
                "call the event organiser on {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 7b - Contribution target UPDATED (pledge increased on existing pledge)
    "contribution_target_updated": {
        "sw": {
            "title": "AHADI YA MCHANGO",
            "body": (
                "Habari {contributor_name}, tumepokea ongezeko la ahadi "
                "yako ya mchango kwa ajili ya {event_name} kiasi cha "
                "{increase_text}. Jumla ya ahadi yako ni {total_target_text}. "
                "Asante kwa ukarimu wako. Kwa msaada, mpigie mratibu wa "
                "tukio kupitia {organizer_phone}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "CONTRIBUTION PLEDGE",
            "body": (
                "Hello {contributor_name}, we have received an increase to "
                "your contribution pledge for {event_name} of "
                "{increase_text}. Your total pledge is now "
                "{total_target_text}. Thank you for your generosity. For "
                "help, call the event organiser on {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 7c - DEPRECATED alias for backwards compatibility only. Do NOT submit
    # to Meta. New code must use ``contribution_target_set`` or
    # ``contribution_target_updated``. Pledge reductions also fall back to
    # this key today (see ``user_contributors.py``); revisit if a dedicated
    # reduction template is approved.
    "contribution_pledge_set": {
        "sw": {
            "title": "AHADI YA MCHANGO",
            "body": (
                "Habari {contributor_name}, ahadi ya mchango wako kwa "
                "ajili ya {event_name} ni {target_text}. Kwa msaada, "
                "mpigie mratibu wa tukio kupitia {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "CONTRIBUTION PLEDGE",
            "body": (
                "Hello {contributor_name}, your pledge for {event_name} "
                "is {target_text}. For help, call the organiser on "
                "{organizer_phone}.\n" + SIGN_OFF
            ),
        },
    },
    # 8
    "contribution_thank_you": {
        "sw": {
            "title": "ASANTE KWA MCHANGO",
            "body": (
                "Habari {contributor_name}, asante kwa mchango wako wa "
                "{amount_text} kwa ajili ya {event_name}. {custom_message} "
                "Kwa msaada, mpigie mratibu wa tukio kupitia "
                "{organizer_phone}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "THANK YOU",
            "body": (
                "Hello {contributor_name}, thank you for your contribution "
                "of {amount_text} towards {event_name}. {custom_message} "
                "For help, call the organiser on {organizer_phone}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 9
    "guest_contribution_invite": {
        "sw": {
            "title": "MAOMBI YA MCHANGO",
            "body": (
                "Habari {contributor_name}, {organiser_name} amekuomba "
                "kuchangia {pledge_amount_text} kwa ajili ya {event_name}. "
                "Unaweza kulipa kupitia link hii: {payment_url}\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "CONTRIBUTION INVITATION",
            "body": (
                "Hello {contributor_name}, {organiser_name} has invited "
                "you to contribute {pledge_amount_text} towards "
                "{event_name}. You can pay securely here: {payment_url}\n"
                + SIGN_OFF
            ),
        },
    },
    # 10
    "guest_contribution_receipt": {
        "sw": {
            "title": "MALIPO YAMEFANIKIWA",
            "body": (
                "Habari {contributor_name}, asante. Malipo yako ya "
                "{amount_text} kwa ajili ya {event_name} yamefanikiwa. "
                "Jumla uliyolipa hadi sasa ni {total_paid_text}. Salio "
                "lako ni {balance_text}. Kumbukumbu ya muamala: "
                "{transaction_code}. Risiti yako ipo hapa: {receipt_url}\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT SUCCESSFUL",
            "body": (
                "Hello {contributor_name}, thank you. Your payment of "
                "{amount_text} for {event_name} was successful. You have "
                "paid {total_paid_text} so far. Your remaining balance is "
                "{balance_text}. Transaction reference: {transaction_code}. "
                "View your receipt here: {receipt_url}\n" + SIGN_OFF
            ),
        },
    },
    # 11
    "payment_received_generic": {
        "sw": {
            "title": "MALIPO YAMEINGIA",
            "body": (
                "Umepokea {amount_text} kutoka kwa {payer_name} kwa ajili "
                "ya {purpose}. Kumbukumbu ya muamala: {transaction_code}.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT RECEIVED",
            "body": (
                "You have received {amount_text} from {payer_name} for "
                "{purpose}. Transaction reference: {transaction_code}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 12
    "payment_confirmation_payer": {
        "sw": {
            "title": "MALIPO YAMEFANIKIWA",
            "body": (
                "Habari {payer_name}, malipo yako ya {amount_text} "
                "kwa ajili ya {purpose} yamefanikiwa. Kumbukumbu ya "
                "muamala: {transaction_code}. Tafadhali hifadhi ujumbe huu "
                "kwa kumbukumbu zako.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT SUCCESSFUL",
            "body": (
                "Hello {payer_name}, your payment of {amount_text} "
                "for {purpose} was successful. Transaction reference: "
                "{transaction_code}. Please keep this message for your "
                "records.\n" + SIGN_OFF
            ),
        },
    },
    # 13
    "organiser_contribution_received": {
        "sw": {
            "title": "MCHANGO UMEPOKELEWA",
            "body": (
                "Habari {organizer_name}, umepokea mchango wa "
                "{amount_text} kutoka kwa {contributor_name} kwa ajili ya "
                "{event_name}. Kumbukumbu ya muamala: {transaction_code}.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "CONTRIBUTION RECEIVED",
            "body": (
                "Hello {organizer_name}, you have received a contribution "
                "of {amount_text} from {contributor_name} for "
                "{event_name}. Transaction reference: {transaction_code}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 14
    "vendor_booking_paid": {
        "sw": {
            "title": "MALIPO YA HUDUMA",
            "body": (
                "Habari {vendor_name}, umepokea malipo ya {amount_text} "
                "kutoka kwa {client_name} kwa ajili ya huduma yako "
                "{service_title}. Kiasi cha huduma kilichokubaliwa ni "
                "{service_amount_text}. Jumla uliyolipwa hadi sasa ni "
                "{total_paid_text}. Salio lililobaki ni {balance_text}. "
                "Kumbukumbu ya muamala: {transaction_code}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "SERVICE PAYMENT RECEIVED",
            "body": (
                "Hello {vendor_name}, you have received {amount_text} "
                "from {client_name} for your service {service_title}. The "
                "agreed service amount is {service_amount_text}. You have "
                "received {total_paid_text} so far. The remaining balance "
                "is {balance_text}. Transaction reference: "
                "{transaction_code}.\n" + SIGN_OFF
            ),
        },
    },
    # 15
    "admin_payment_alert": {
        "sw": {
            "title": "[Nuru Admin]",
            "body": (
                "[Nuru Admin] {amount_text} zimepokelewa kupitia "
                "{method} kwa ajili ya {purpose} {target_label}. Mlipaji: "
                "{payer_name} ({payer_phone}). Ref: {transaction_code}.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "[Nuru Admin]",
            "body": (
                "[Nuru Admin] {amount_text} received via {method} "
                "for {purpose} {target_label}. Payer: {payer_name} "
                "({payer_phone}). Ref: {transaction_code}.\n" + SIGN_OFF
            ),
        },
    },
    # 16
    "vendor_otp_claim": {
        "sw": {
            "title": "THIBITISHA MALIPO",
            "body": (
                "Habari {vendor_first_name}, {organiser_name} ameweka "
                "taarifa ya malipo ya {amount_text} kwa ajili ya "
                "huduma yako {service_title} kwenye {event_name}. Tumia "
                "code hii kuthibitisha malipo: {code}. Code itaisha "
                "matumizi ndani ya dakika {minutes}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "CONFIRM PAYMENT",
            "body": (
                "Hello {vendor_first_name}, {organiser_name} has recorded "
                "a payment of {amount_text} for your service "
                "\"{service_title}\" at {event_name}. Use this code to "
                "confirm the payment: {code}. The code expires in "
                "{minutes} minutes.\n" + SIGN_OFF
            ),
        },
    },
    # 17
    "vendor_otp_resend": {
        "sw": {
            "title": "CODE YA MALIPO",
            "body": (
                "Habari {vendor_first_name}, hii ni code yako ya "
                "kuthibitisha malipo ya {amount_text} kutoka kwa "
                "{organiser_name} kwa ajili ya huduma yako "
                "{service_title} kwenye {event_name}: {code}. Code itaisha "
                "matumizi ndani ya dakika {minutes}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT CODE",
            "body": (
                "Hello {vendor_first_name}, here is your code to confirm "
                "the payment of {amount_text} from {organiser_name} "
                "for your service \"{service_title}\" at {event_name}: "
                "{code}. The code expires in {minutes} minutes.\n"
                + SIGN_OFF
            ),
        },
    },
    # 18
    "vendor_confirmation_receipt": {
        "sw": {
            "title": "MALIPO YAMETHIBITISHWA",
            "body": (
                "Habari {vendor_first_name}, umethibitisha kupokea "
                "{amount_text} kutoka kwa {organiser_name} kwa "
                "ajili ya {event_name}. Kiasi kilichobaki ni "
                "{balance_text}.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT CONFIRMED",
            "body": (
                "Hello {vendor_first_name}, you have confirmed receiving "
                "{amount_text} from {organiser_name} for "
                "{event_name}. Remaining amount: {balance_text}.\n"
                + SIGN_OFF
            ),
        },
    },
    # 19
    "vendor_confirmation_receipt_full": {
        "sw": {
            "title": "MALIPO YAMEKAMILIKA",
            "body": (
                "Habari {vendor_first_name}, umethibitisha kupokea "
                "{amount_text} kutoka kwa {organiser_name} kwa "
                "ajili ya {event_name}. Sasa umelipwa kikamilifu.\n"
                + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT COMPLETED",
            "body": (
                "Hello {vendor_first_name}, you have confirmed receiving "
                "{amount_text} from {organiser_name} for "
                "{event_name}. You have now been paid in full.\n" + SIGN_OFF
            ),
        },
    },
    # 20
    "organiser_committee_vendor_confirmed": {
        "sw": {
            "title": "MALIPO YAMETHIBITISHWA",
            "body": (
                "Habari {recipient_first_name}, {vendor_name} "
                "amethibitisha kupokea {amount_text} kutoka kwa "
                "{organiser_name} kwa ajili ya {event_name}. Kiasi "
                "kilichobaki ni {balance_text}. Fungua Nuru kuona "
                "taarifa kamili.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "PAYMENT CONFIRMED",
            "body": (
                "Hello {recipient_first_name}, {vendor_name} has "
                "confirmed receiving {amount_text} from "
                "{organiser_name} for {event_name}. Remaining amount: "
                "{balance_text}. Open Nuru for full details.\n"
                + SIGN_OFF
            ),
        },
    },
    # 21
    "expense_recorded": {
        "sw": {
            "title": "MATUMIZI YAMEREKODIWA",
            "body": (
                "Habari {recipient_first_name}, {recorder_name} amerekodi "
                "matumizi mapya ya {amount_text} kwenye kipengele "
                "cha {category} kwa ajili ya {event_name}. Fungua Nuru "
                "kuona mchanganuo kamili.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "NEW EXPENSE RECORDED",
            "body": (
                "Hello {recipient_first_name}, {recorder_name} has "
                "recorded a new expense of {amount_text} under "
                "{category} for {event_name}. Open Nuru to see the full "
                "breakdown.\n" + SIGN_OFF
            ),
        },
    },
    # 21b — Owner / creator summary when an expense is logged
    "owner_expense_summary": {
        "sw": {
            "title": "MUHTASARI WA MATUMIZI",
            "body": (
                "Habari {organizer_name},\n\n"
                "Matumizi mapya yamerekodiwa kwenye tukio la {event_name}.\n\n"
                "Kipengele cha matumizi: {expense_name}\n"
                "Kiasi kilichotumika: {expense_amount}\n\n"
                "Muhtasari wa bajeti:\n"
                "Bajeti kuu: {total_budget}\n"
                "Jumla ya matumizi: {total_expenses}\n"
                "Salio lililobaki: {remaining_balance}\n\n"
                "Kwa mchanganuo kamili wa matumizi na bajeti, tafadhali "
                "ingia kwenye Nuru.\n\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "EXPENSE SUMMARY",
            "body": (
                "Hello {organizer_name},\n\n"
                "A new expense has been recorded for {event_name}.\n\n"
                "Expense item: {expense_name}\n"
                "Amount spent: {expense_amount}\n\n"
                "Budget summary:\n"
                "Total contributed: {total_budget}\n"
                "Total expenses: {total_expenses}\n"
                "Remaining balance: {remaining_balance}\n\n"
                "For the full breakdown of expenses and budget, please "
                "open Nuru.\n\n" + SIGN_OFF
            ),
        },
    },
    # 22
    "service_booking_notification": {
        "sw": {
            "title": "OMBI JIPYA LA HUDUMA",
            "body": (
                "Habari {provider_name}, {client_name} ameomba huduma "
                "yako {service_name} kwa ajili ya {event_name}. "
                "Fungua Nuru kukagua na kujibu ombi hili.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "NEW SERVICE BOOKING",
            "body": (
                "Hello {provider_name}, {client_name} has booked your "
                "service {service_name}for {event_name}. Open Nuru "
                "to review and respond.\n" + SIGN_OFF
            ),
        },
    },
    # 23
    "booking_accepted": {
        "sw": {
            "title": "OMBI LA HUDUMA LIMEKUBALIWA",
            "body": (
                "Habari {requester_first_name}, hongera. "
                "{vendor_name} amekubali ombi lako la huduma "
                "{service_name} kwa ajili ya {event_name}. Fungua "
                "Nuru kuona hatua zinazofuata.\n" + SIGN_OFF
            ),
        },
        "en": {
            "title": "BOOKING ACCEPTED",
            "body": (
                "Hello {requester_first_name}, good news. {vendor_name} "
                "has accepted your booking for \"{service_name}\" at "
                "{event_name}. Open Nuru to see the next steps.\n"
                + SIGN_OFF
            ),
        },
    },
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def _normalize_lang(lang: Optional[str]) -> str:
    if not lang:
        return DEFAULT_LANGUAGE
    lang = str(lang).strip().lower()
    return lang if lang in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


class _SafeDict(dict):
    """Dict that returns ``""`` for missing keys so format() never KeyErrors."""

    def __missing__(self, key):  # noqa: D401
        return ""


def render_message(key: str, lang: Optional[str] = None, **placeholders) -> dict:
    """Render the template ``key`` in ``lang`` (SW fallback).

    Returns a dict with ``title`` and ``body``. Unknown keys raise
    ``KeyError`` — this is intentional so a typo at a call site shows up
    immediately in CI / tests.
    """
    if key not in TEMPLATES:
        raise KeyError(f"Unknown notification template key: {key!r}")

    language = _normalize_lang(lang)
    tpl = TEMPLATES[key].get(language) or TEMPLATES[key][DEFAULT_LANGUAGE]

    safe_placeholders = _SafeDict(placeholders)
    return {
        "title": tpl["title"].format_map(safe_placeholders),
        "body": tpl["body"].format_map(safe_placeholders),
    }


def resolve_user_language(db, user_id, fallback: str = DEFAULT_LANGUAGE) -> str:
    """Look up the recipient's ``notification_language`` preference.

    Best-effort: never raises. Returns ``fallback`` (default Swahili) if
    the user has no row, no preference, or an unsupported value, or if
    the database / model has not yet been migrated.
    """
    if not user_id:
        return _normalize_lang(fallback)
    try:
        from models import UserSetting  # local import to avoid cycles
        row = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
        if row is None:
            return _normalize_lang(fallback)
        value = getattr(row, "notification_language", None)
        return _normalize_lang(value or fallback)
    except Exception:
        return _normalize_lang(fallback)
