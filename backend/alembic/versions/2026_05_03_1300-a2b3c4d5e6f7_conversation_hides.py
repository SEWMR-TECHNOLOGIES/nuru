"""Per-user soft-delete (hide) of conversations.

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-03 13:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_hides (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            hidden_at timestamp NOT NULL DEFAULT now(),
            created_at timestamp NOT NULL DEFAULT now(),
            UNIQUE (conversation_id, user_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_conv_hides_user ON conversation_hides(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_conv_hides_conv ON conversation_hides(conversation_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS conversation_hides")
