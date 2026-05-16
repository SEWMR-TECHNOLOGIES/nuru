"""pledge reminder template: drop {{6}} pay_link from body (now URL button)

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-17 10:00:00.000000

The Meta-approved nuru_pledge_remind_{en,sw} templates carry the payment
link as a dynamic URL button — the body text no longer contains {{6}}.
Update body_default, placeholders and required_placeholders to match.
"""
from alembic import op


revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(r"""
        UPDATE event_reminder_templates
        SET body_default = E'This is a friendly reminder about your pending pledge for the event "{{2}}", which is scheduled to take place on {{3}}.\n\nYour total pledge is {{4}} and the outstanding balance still awaited is {{5}}.\n\nPlease tap the button below to securely complete your contribution at any time before the event date.\n\nThank you for your generosity and continued support.',
            placeholders = '["recipient_name","event_name","event_datetime","pledge_amount","balance"]'::jsonb,
            required_placeholders = ARRAY['event_name','event_datetime','pledge_amount','balance']
        WHERE code = 'pledge_remind_en';
    """)
    op.execute(r"""
        UPDATE event_reminder_templates
        SET body_default = E'Unakumbushwa kukamilisha ahadi yako ya tukio la "{{2}}", ambalo limepangwa kufanyika tarehe {{3}}.\n\nAhadi yako jumla ni {{4}} na kiasi kilichobaki ni {{5}}.\n\nTafadhali bonyeza kitufe hapa chini kukamilisha mchango wako.\n\nAsante kwa ukarimu wako.',
            placeholders = '["recipient_name","event_name","event_datetime","pledge_amount","balance"]'::jsonb,
            required_placeholders = ARRAY['event_name','event_datetime','pledge_amount','balance']
        WHERE code = 'pledge_remind_sw';
    """)


def downgrade() -> None:
    # No-op: the previous body text is preserved in the c1d2e3f4a5b6 migration.
    pass
