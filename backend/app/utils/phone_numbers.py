"""
phone_numbers
=============
Country-aware phone normalization utility.

Returns a structured dict so the caller can store raw + normalized + country
code consistently. Prefers the `phonenumbers` library (much better at
international parsing) but degrades to manual rules when it isn't installed.

Tanzania is the system default country only when the number is clearly local
(starts with 0 / bare 9 digits) and no explicit country context was passed.
"""
from __future__ import annotations

import re
from typing import Optional, TypedDict

try:
    import phonenumbers
    from phonenumbers import NumberParseException
    HAS_PHONENUMBERS = True
except Exception:  # pragma: no cover
    phonenumbers = None
    NumberParseException = Exception
    HAS_PHONENUMBERS = False


DEFAULT_COUNTRY = "TZ"

# Country dial codes we frequently see — used by the manual fallback path.
_COUNTRY_DIAL = {
    "TZ": "255",
    "KE": "254",
    "UG": "256",
    "RW": "250",
    "BI": "257",
    "ZM": "260",
    "MZ": "258",
    "MW": "265",
    "ZA": "27",
    "NG": "234",
    "GH": "233",
    "ET": "251",
    "EG": "20",
    "GB": "44",
    "US": "1",
}


class NormalizedPhone(TypedDict, total=False):
    ok: bool
    raw: str
    normalized: str            # digits only, includes country code, no leading +
    e164: str                  # +<cc><national>
    country_code: str          # e.g. "255"
    country_iso: str           # e.g. "TZ"
    national_number: str
    normalization_status: str  # ok | invalid | empty
    normalization_error: Optional[str]


def _strip(raw: str) -> str:
    return re.sub(r"[^\d+]", "", raw or "")


def _fail(raw: str, reason: str) -> NormalizedPhone:
    return {
        "ok": False,
        "raw": raw or "",
        "normalized": "",
        "e164": "",
        "country_code": "",
        "country_iso": "",
        "national_number": "",
        "normalization_status": "invalid" if raw else "empty",
        "normalization_error": reason,
    }


def normalize_phone(raw: str, country: Optional[str] = None) -> NormalizedPhone:
    """
    Normalize a phone number to international format.

    - If the number is already international (starts with + or with a known
      country dial code), the country code is preserved.
    - If the number is local (07XXXXXXXX / bare 9 digits), `country` is used
      to infer the dial code; falls back to Tanzania.
    """
    if raw is None:
        return _fail("", "empty")
    raw = str(raw).strip()
    if not raw:
        return _fail("", "empty")

    cleaned = _strip(raw)
    if not cleaned:
        return _fail(raw, "no digits")

    country_iso = (country or "").upper().strip() or None

    # Prefer the phonenumbers library when available.
    if HAS_PHONENUMBERS:
        try:
            region = country_iso or DEFAULT_COUNTRY
            # `phonenumbers.parse` accepts a leading + (international) or a
            # local number when a region is provided.
            parse_input = cleaned if cleaned.startswith("+") else (
                "+" + cleaned if _looks_international(cleaned) else cleaned
            )
            obj = phonenumbers.parse(parse_input, region)
            if not phonenumbers.is_possible_number(obj) or not phonenumbers.is_valid_number(obj):
                # Try once more with the default region in case region was wrong.
                if region != DEFAULT_COUNTRY:
                    obj = phonenumbers.parse(parse_input, DEFAULT_COUNTRY)
                if not phonenumbers.is_valid_number(obj):
                    return _fail(raw, "not a valid number")
            cc = str(obj.country_code)
            national = str(obj.national_number)
            normalized = cc + national
            iso = phonenumbers.region_code_for_number(obj) or country_iso or ""
            return {
                "ok": True,
                "raw": raw,
                "normalized": normalized,
                "e164": "+" + normalized,
                "country_code": cc,
                "country_iso": iso,
                "national_number": national,
                "normalization_status": "ok",
                "normalization_error": None,
            }
        except NumberParseException as e:
            return _fail(raw, f"parse error: {e}")
        except Exception as e:
            return _fail(raw, f"unexpected: {e}")

    # ── Manual fallback (no phonenumbers package) ──
    return _manual_normalize(raw, cleaned, country_iso)


def _looks_international(cleaned_no_plus: str) -> bool:
    """Heuristic: digits-only string that starts with a known dial code."""
    s = cleaned_no_plus.lstrip("+")
    return any(s.startswith(dc) for dc in _COUNTRY_DIAL.values())


def _manual_normalize(raw: str, cleaned: str,
                      country_iso: Optional[str]) -> NormalizedPhone:
    digits = cleaned.lstrip("+")

    iso = country_iso or DEFAULT_COUNTRY
    cc = _COUNTRY_DIAL.get(iso, _COUNTRY_DIAL[DEFAULT_COUNTRY])

    # International — starts with any known dial code → keep
    for dc_iso, dc in _COUNTRY_DIAL.items():
        if digits.startswith(dc) and len(digits) >= len(dc) + 6:
            national = digits[len(dc):]
            # strip a leading 0 right after country code (255 0 7XX… → 255 7XX…)
            if national.startswith("0"):
                national = national.lstrip("0")
                digits = dc + national
            return {
                "ok": True, "raw": raw, "normalized": digits,
                "e164": "+" + digits, "country_code": dc,
                "country_iso": dc_iso, "national_number": national,
                "normalization_status": "ok", "normalization_error": None,
            }

    # Local — Tanzania-style 07XXXXXXXX or 06XXXXXXXX (10 digits, leading 0)
    if iso == "TZ" and digits.startswith("0") and len(digits) == 10 and digits[1] in ("6", "7"):
        national = digits[1:]
        normalized = "255" + national
        return {
            "ok": True, "raw": raw, "normalized": normalized,
            "e164": "+" + normalized, "country_code": "255",
            "country_iso": "TZ", "national_number": national,
            "normalization_status": "ok", "normalization_error": None,
        }

    # Local — bare 9 digits, assume default country
    if len(digits) == 9 and not digits.startswith("0"):
        normalized = cc + digits
        return {
            "ok": True, "raw": raw, "normalized": normalized,
            "e164": "+" + normalized, "country_code": cc,
            "country_iso": iso, "national_number": digits,
            "normalization_status": "ok", "normalization_error": None,
        }

    if 7 <= len(digits) <= 15:
        # Couldn't infer reliably; store as-is to avoid mangling international.
        return {
            "ok": True, "raw": raw, "normalized": digits,
            "e164": "+" + digits, "country_code": "",
            "country_iso": "", "national_number": digits,
            "normalization_status": "ok", "normalization_error": None,
        }

    return _fail(raw, "wrong length")


def phone_tail(normalized: str, n: int = 4) -> str:
    """Last N digits for safe logging."""
    if not normalized:
        return ""
    return normalized[-n:]
