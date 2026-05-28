"""Central helpers for the Event Owner feature.

Background
----------
An event has two privileged users:

- ``organizer_id``  - the user who SUBMITTED / CREATED the event row.
- ``event_owner_user_id`` - the actual OWNER (may be a different person
  the creator is acting on behalf of). For events that pre-date the
  Event Owner feature this is back-filled to ``organizer_id``.

In addition, ``recognizable_event_owner_name`` is an optional display
name that overrides the owner's account full name in public-facing
communication (WhatsApp templates, SMS, invitations, etc.).

Both privileged users have full management rights on the event - any
authorization check must accept either id.

Use :func:`user_can_manage_event` everywhere instead of comparing
``event.organizer_id`` to ``current_user.id`` directly.
Use :func:`get_event_owner_display_name` everywhere a human-facing
owner name is rendered or sent.
"""
from __future__ import annotations

from typing import Optional, Any
from uuid import UUID

from sqlalchemy.orm import Session

from models import Event, User


def _coerce(uid) -> Optional[str]:
    if uid is None:
        return None
    try:
        return str(uid)
    except Exception:
        return None


def event_owner_id(event: Event) -> Optional[str]:
    """Owner-of-record id (falls back to organizer if unset)."""
    return _coerce(getattr(event, "event_owner_user_id", None)) or _coerce(
        getattr(event, "organizer_id", None)
    )


def event_creator_id(event: Event) -> Optional[str]:
    """Submitter / creator id."""
    return _coerce(getattr(event, "organizer_id", None))


def privileged_user_ids(event: Event) -> set[str]:
    """Set of user ids with full event-management privileges."""
    ids = set()
    for uid in (
        getattr(event, "event_owner_user_id", None),
        getattr(event, "organizer_id", None),
    ):
        v = _coerce(uid)
        if v:
            ids.add(v)
    return ids


def user_can_manage_event(event: Event, user: Any) -> bool:
    """Return True if the user is either the creator or the recorded owner.

    Accepts a ``User`` model or anything with an ``id`` attribute.
    """
    if not event or not user:
        return False
    uid = _coerce(getattr(user, "id", None) or user)
    if not uid:
        return False
    return uid in privileged_user_ids(event)


def get_event_owner_display_name(
    event: Event,
    *,
    db: Optional[Session] = None,
    fallback: str = "",
) -> str:
    """Display name to use in any owner-mentioning communication.

    Priority:
      1. ``event.recognizable_event_owner_name`` (if non-empty)
      2. Owner user's ``full_name`` (``first_name last_name``)
      3. Creator user's ``full_name``
      4. Provided ``fallback`` (default empty string)

    A ``db`` session may be supplied so the helper can lazy-load
    related users if they are not already on the ORM object. If no
    session is given we only use already-loaded relationships.
    """
    if not event:
        return fallback or ""

    nice = (getattr(event, "recognizable_event_owner_name", None) or "").strip()
    if nice:
        return nice

    def _name_for(uid) -> Optional[str]:
        if not uid:
            return None
        user = None
        if db is not None:
            user = db.query(User).filter(User.id == uid).first()
        if not user:
            return None
        first = (user.first_name or "").strip()
        last = (user.last_name or "").strip()
        joined = (first + " " + last).strip()
        return joined or (user.username or "").strip() or None

    owner_name = _name_for(getattr(event, "event_owner_user_id", None))
    if owner_name:
        return owner_name

    creator_name = _name_for(getattr(event, "organizer_id", None))
    if creator_name:
        return creator_name

    return fallback or ""
