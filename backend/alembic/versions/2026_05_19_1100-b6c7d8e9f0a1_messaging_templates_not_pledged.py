"""extend event_messaging_templates case_type to allow 'not_pledged'

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-05-19 11:00:00.000000

The contributor messaging composer now exposes a fourth category for
contributors who were added without a pledge (pledge_amount = 0 and
no payments). We need to widen the CHECK constraint accordingly so the
per-event template save can persist their custom message.
"""
from alembic import op


revision = "b6c7d8e9f0a1"
down_revision = "a5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE event_messaging_templates
            DROP CONSTRAINT IF EXISTS ck_event_messaging_templates_case;
        ALTER TABLE event_messaging_templates
            DROP CONSTRAINT IF EXISTS event_messaging_templates_case_type_check;
        ALTER TABLE event_messaging_templates
            ADD CONSTRAINT ck_event_messaging_templates_case
            CHECK (case_type IN ('no_contribution', 'partial', 'completed', 'not_pledged'));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM event_messaging_templates WHERE case_type = 'not_pledged';
        ALTER TABLE event_messaging_templates
            DROP CONSTRAINT IF EXISTS ck_event_messaging_templates_case;
        ALTER TABLE event_messaging_templates
            ADD CONSTRAINT ck_event_messaging_templates_case
            CHECK (case_type IN ('no_contribution', 'partial', 'completed'));
        """
    )
