"""Smoke tests for services/contributor_claim.

These tests use a real Postgres session via the project's `core.database`.
They are pure-Python unit-style probes — they don't spin up the API.

Run with: ``pytest backend/tests/test_contributor_claim.py -q``
"""
import os
import sys

import pytest

HERE = os.path.dirname(__file__)
APP = os.path.abspath(os.path.join(HERE, "..", "app"))
if APP not in sys.path:
    sys.path.insert(0, APP)


def test_last9_helper():
    from services.contributor_claim import _last9
    assert _last9(None) is None
    assert _last9("") is None
    assert _last9("+255 653 750 805") == "653750805"
    assert _last9("0653750805") == "653750805"
    assert _last9("653750805") == "653750805"
    # Less than 9 digits → None
    assert _last9("12345") is None


def test_claim_noop_for_missing_user():
    from services.contributor_claim import claim_existing_contributor_records_for_user

    class _Stub:
        id = None
        phone = None
        email = None

    out = claim_existing_contributor_records_for_user(None, _Stub())
    assert out == {"linked_contributors": 0, "added_group_members": 0}


def test_claim_for_user_id_invalid():
    from services.contributor_claim import claim_for_user_id
    out = claim_for_user_id(None, "not-a-uuid")
    assert out.get("error") == "invalid id"


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="needs DATABASE_URL for live DB integration",
)
def test_claim_is_idempotent_against_live_db():
    """Running claim twice produces 0 new links the second time."""
    from core.database import SessionLocal
    from models import User
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.is_active == True).first()  # noqa: E712
        if not u:
            pytest.skip("no active users")
        from services.contributor_claim import claim_existing_contributor_records_for_user
        claim_existing_contributor_records_for_user(db, u)
        second = claim_existing_contributor_records_for_user(db, u)
        # Second run must not add new group members for an already-claimed user.
        assert second["added_group_members"] == 0
    finally:
        db.close()
