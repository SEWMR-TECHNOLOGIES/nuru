"""Contributor → User account claim service.

When a Nuru user signs up or signs in, this service:

1. Finds every `user_contributors` row whose **last-9-digit phone** matches
   the user's phone (or whose email matches), and that is not yet linked to
   a Nuru user.
2. Sets `contributor_user_id = user.id` on those rows.
3. For each `event_contributors` row that hangs off those `user_contributors`,
   ensures an `event_group_members` row exists (role=contributor, user_id=user)
   in the event's group workspace, so the user immediately sees those events
   in their "my event groups" list without losing history.

It is **fully idempotent** — running it twice is a no-op. It NEVER blocks
auth flows: every caller wraps it in try/except.

This module is intentionally side-effect-free besides DB writes:
no SMS, no WhatsApp, no notifications. Welcomes are handled elsewhere.
"""
from __future__ import annotations

import re
import uuid
import logging
from difflib import SequenceMatcher
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


def _last9(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else None


def _last_n(phone: Optional[str], n: int) -> Optional[str]:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits[-n:] if len(digits) >= n else None


_NAME_STOPWORDS = {
    "mr", "mrs", "ms", "miss", "dr", "prof", "sir", "madam",
    "bin", "binti", "bt", "the", "and",
}


def _normalize_name(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _name_tokens(s: str) -> list[str]:
    return [t for t in _normalize_name(s).split() if t and t not in _NAME_STOPWORDS and len(t) >= 2]


def _name_similarity(a: str, b: str) -> float:
    """Combined Jaccard + sequence similarity in [0,1]. Either signal can clear the bar.

    Jaccard catches token reordering ("John Doe" vs "Doe John").
    SequenceMatcher catches typos. Containment ("Asha Mwinyi" ⊂ "Asha S Mwinyi") wins outright.
    """
    ta, tb = set(_name_tokens(a)), set(_name_tokens(b))
    if not ta or not tb:
        return 0.0
    jacc = len(ta & tb) / len(ta | tb)
    seq = SequenceMatcher(None, _normalize_name(a), _normalize_name(b)).ratio()
    contained = 1.0 if (ta.issubset(tb) or tb.issubset(ta)) and min(len(ta), len(tb)) >= 2 else 0.0
    return max(jacc, seq, contained)


# Acceptance threshold tuned so common variants link but strangers don't collide.
_FUZZY_THRESHOLD = 0.78


def claim_existing_contributor_records_for_user(
    db: Session,
    user,
) -> dict:
    """Link orphan `user_contributors` to `user` and sync event group membership.

    Returns a small summary dict so callers / admin tools can log / display
    what happened: ``{"linked_contributors": N, "added_group_members": M}``.

    Safe to call on every signup and every login — does nothing once linked.
    """
    summary = {"linked_contributors": 0, "linked_fuzzy": 0, "added_group_members": 0}

    if user is None or getattr(user, "id", None) is None:
        return summary

    user_id = str(user.id)
    last9 = _last9(getattr(user, "phone", None))
    email = (getattr(user, "email", None) or "").strip().lower() or None

    if not last9 and not email:
        return summary

    # ── 1. Link orphan user_contributors rows by phone-last9 OR email ─────
    # We use raw SQL with the same `right(regexp_replace(...))` pattern as
    # the existing 2026_04_19 migration so behavior is consistent.
    try:
        result = db.execute(
            text(
                """
                UPDATE user_contributors uc
                SET contributor_user_id = :uid
                WHERE uc.contributor_user_id IS NULL
                  AND (
                    (:last9 <> '' AND uc.phone IS NOT NULL
                       AND RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 9) = :last9)
                    OR
                    (:email <> '' AND uc.email IS NOT NULL
                       AND LOWER(uc.email) = :email)
                  )
                RETURNING uc.id
                """
            ),
            {
                "uid": user_id,
                "last9": last9 or "",
                "email": email or "",
            },
        )
        linked_ids = [row[0] for row in result.fetchall()]
        summary["linked_contributors"] = len(linked_ids)
    except Exception as e:
        db.rollback()
        logger.warning("[contributor_claim] link step failed: %s", e)
        return summary

    # ── 1b. Fuzzy name pass ───────────────────────────────────────────────
    # Some contributors are added without a phone or with a different phone
    # format (e.g. work line vs personal). We accept a fuzzy NAME match only
    # when there is a weak corroborating signal: the last 6 digits of the
    # phone match, OR the email local-part matches. This stops strangers
    # with similar names from being merged.
    try:
        first = (getattr(user, "first_name", "") or "").strip()
        last = (getattr(user, "last_name", "") or "").strip()
        full_name = (first + " " + last).strip()
        last6 = _last_n(getattr(user, "phone", None), 6)
        email_local = email.split("@", 1)[0] if email else None

        if full_name and (last6 or email_local):
            candidates = db.execute(
                text(
                    """
                    SELECT uc.id, uc.name
                    FROM user_contributors uc
                    WHERE uc.contributor_user_id IS NULL
                      AND (
                        (:last6 <> '' AND uc.phone IS NOT NULL
                           AND RIGHT(REGEXP_REPLACE(uc.phone, '[^0-9]', '', 'g'), 6) = :last6)
                        OR
                        (:eloc <> '' AND uc.email IS NOT NULL
                           AND LOWER(SPLIT_PART(uc.email, '@', 1)) = :eloc)
                      )
                    LIMIT 500
                    """
                ),
                {"last6": last6 or "", "eloc": email_local or ""},
            ).fetchall()

            fuzzy_ids: list[str] = []
            for row in candidates:
                if _name_similarity(full_name, row[1] or "") >= _FUZZY_THRESHOLD:
                    fuzzy_ids.append(str(row[0]))

            if fuzzy_ids:
                db.execute(
                    text(
                        """
                        UPDATE user_contributors
                        SET contributor_user_id = :uid
                        WHERE id = ANY(:ids::uuid[])
                          AND contributor_user_id IS NULL
                        """
                    ),
                    {"uid": user_id, "ids": fuzzy_ids},
                )
                summary["linked_fuzzy"] = len(fuzzy_ids)
    except Exception as e:
        db.rollback()
        logger.warning("[contributor_claim] fuzzy pass failed: %s", e)

    # ── 2. Ensure event_group_members rows for every event the contributor
    #      is on. We pull the full set of (event_id, contributor_id) for ALL
    #      contributor rows now linked to this user (not just freshly linked
    #      ones — this catches earlier signups that missed group sync).
    try:
        rows = db.execute(
            text(
                """
                INSERT INTO event_group_members
                    (id, group_id, user_id, contributor_id, role, is_admin, joined_at, created_at, updated_at)
                SELECT
                    gen_random_uuid(),
                    eg.id,
                    :uid,
                    uc.id,
                    'contributor',
                    false,
                    now(), now(), now()
                FROM user_contributors uc
                JOIN event_contributors ec ON ec.contributor_id = uc.id
                JOIN event_groups eg       ON eg.event_id = ec.event_id
                WHERE uc.contributor_user_id = :uid
                ON CONFLICT (group_id, user_id) DO NOTHING
                RETURNING id
                """
            ),
            {"uid": user_id},
        )
        summary["added_group_members"] = len(rows.fetchall())
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("[contributor_claim] group sync failed: %s", e)

    return summary


def claim_for_user_id(db: Session, user_id: str) -> dict:
    """Convenience for admin/backfill paths."""
    from models import User
    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return {"linked_contributors": 0, "added_group_members": 0, "error": "invalid id"}
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return {"linked_contributors": 0, "added_group_members": 0, "error": "user not found"}
    return claim_existing_contributor_records_for_user(db, user)


def claim_for_all_users(db: Session, limit: int | None = None) -> dict:
    """Bulk backfill — used once per environment after deploy."""
    from models import User
    q = db.query(User.id).filter(User.is_active == True)  # noqa: E712
    if limit:
        q = q.limit(limit)
    total = {"users": 0, "linked_contributors": 0, "linked_fuzzy": 0, "added_group_members": 0}
    for (uid,) in q.all():
        s = claim_for_user_id(db, str(uid))
        total["users"] += 1
        total["linked_contributors"] += s.get("linked_contributors", 0)
        total["linked_fuzzy"] += s.get("linked_fuzzy", 0)
        total["added_group_members"] += s.get("added_group_members", 0)
    return total
