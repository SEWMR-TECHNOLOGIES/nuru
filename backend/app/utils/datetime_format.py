"""Localised date/time formatting for Nuru notifications.

We deliberately ship inline Swahili / English month + weekday tables so
the formatter works on Vercel without locale packages installed.

Output formats follow the SMS catalogue exactly:

    SW: ``Jumatano, 12 Mei 2026 Saa 13:30``
    EN: ``Wednesday, 12 May 2026 at 13:30``
"""
from __future__ import annotations

from datetime import datetime, date, time, timezone
from typing import Optional


try:  # pytz is already a backend dependency
    import pytz
except Exception:  # pragma: no cover
    pytz = None  # type: ignore


SW_WEEKDAYS = [
    "Jumatatu",   # 0 = Monday
    "Jumanne",
    "Jumatano",
    "Alhamisi",
    "Ijumaa",
    "Jumamosi",
    "Jumapili",
]

SW_MONTHS = [
    "Januari", "Februari", "Machi", "Aprili", "Mei", "Juni",
    "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba",
]

EN_WEEKDAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
]

EN_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _coerce_dt(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    # ``date`` objects (no time component) — promote to midnight datetime.
    # ``datetime`` is a subclass of ``date`` so this branch only catches pure dates.
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str):
        try:
            # Accept ISO 8601, with or without timezone
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None



def _to_zone(dt: datetime, tz_name: Optional[str]) -> datetime:
    if pytz is None or not tz_name:
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    try:
        zone = pytz.timezone(tz_name)
    except Exception:
        zone = pytz.timezone("Africa/Nairobi")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(zone)


def _sw_saa_period(hour: int) -> str:
    """Return the Swahili day-period label for an hour 0-23.

    Mapping (per product spec):
      20:00-03:59 -> Usiku, 04:00-06:59 -> Alfajiri, 07:00-11:59 -> Asubuhi,
      12:00-14:59 -> Alasiri, 15:00-19:59 -> Jioni
    """
    h = hour % 24
    if h >= 20 or h < 4:
        return "Usiku"
    if h < 7:
        return "Alfajiri"
    if h < 12:
        return "Asubuhi"
    if h < 15:
        return "Alasiri"
    return "Jioni"


def _sw_saa_time(hour: int, minute: int) -> str:
    """Render Swahili 'saa' clock e.g. ``Saa 7 Alasiri`` / ``Saa 12:30 Jioni``."""
    saa = ((hour - 6) % 12) or 12
    period = _sw_saa_period(hour)
    if minute:
        return f"Saa {saa}:{minute:02d} {period}"
    return f"Saa {saa} {period}"


def format_event_datetime(value, lang: str = "sw", tz_name: Optional[str] = "Africa/Nairobi") -> str:
    """Return a friendly localised date+time string.

    Returns an empty string when ``value`` is missing so callers can pass
    it straight into a template without guarding.
    """
    dt = _coerce_dt(value)
    if dt is None:
        return ""

    dt = _to_zone(dt, tz_name)
    language = (lang or "sw").lower()
    if language not in ("sw", "en"):
        language = "sw"

    weekday_idx = dt.weekday()
    month_idx = dt.month - 1

    if language == "sw":
        return (
            f"{SW_WEEKDAYS[weekday_idx]}, {dt.day} {SW_MONTHS[month_idx]} "
            f"{dt.year} {_sw_saa_time(dt.hour, dt.minute)}"
        )
    return (
        f"{EN_WEEKDAYS[weekday_idx]}, {dt.day} {EN_MONTHS[month_idx]} "
        f"{dt.year} at {dt.hour:02d}:{dt.minute:02d}"
    )
