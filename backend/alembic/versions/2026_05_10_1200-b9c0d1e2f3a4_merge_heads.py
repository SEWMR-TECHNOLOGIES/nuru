"""merge heads (community_is_verified + event_invitation_content)

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3, e6f7a8b9c0d1
Create Date: 2026-05-10 12:00:00.000000
"""
from typing import Sequence, Union

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = ("a8b9c0d1e2f3", "e6f7a8b9c0d1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
