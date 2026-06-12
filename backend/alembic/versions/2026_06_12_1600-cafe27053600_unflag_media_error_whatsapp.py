"""Unflag numbers wrongly marked not-on-WhatsApp because of 131053.

Revision ID: cafe27053600
Revises: cafe27053500
Create Date: 2026-06-12 16:00:00

Meta error 131053 means "media upload/rejection" (e.g. PNG with alpha,
oversized image). It does NOT mean the phone is not on WhatsApp. The
dispatcher used to lump it in with the not-on-WhatsApp codes, which
falsely flipped ``whatsapp_available`` to False for perfectly valid
recipients. This migration resets that flag for any row whose only
negative signal was error_code 131053.
"""
from typing import Sequence, Union
from alembic import op


revision: str = "cafe27053600"
down_revision: Union[str, None] = "cafe27053500"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE wa_message_logs
           SET whatsapp_available = NULL
         WHERE whatsapp_available IS FALSE
           AND error_code = '131053'
        """
    )


def downgrade() -> None:
    # No-op — we can't safely re-introduce a wrong flag.
    pass
