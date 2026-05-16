"""fundraise template rename: nuru_fundraise_attend_* -> nuru_fundraise_notice_*

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-18 10:00:00.000000

Meta locked the previous Swahili template under MARKETING. We submit new
UTILITY templates under fresh names (`nuru_fundraise_notice_{en,sw}`) with
strictly transactional copy, and point the backend rows at the new names.
"""
from alembic import op


revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(r"""
        UPDATE event_reminder_templates
        SET whatsapp_template_name = 'nuru_fundraise_notice_en',
            body_default = E'We would like to inform you that:\n\n{{2}}',
            protected_prefix = 'Hello {{1}}',
            protected_suffix = 'For questions, please contact the organiser directly.'
        WHERE code = 'fundraise_attend_en';
    """)
    op.execute(r"""
        UPDATE event_reminder_templates
        SET whatsapp_template_name = 'nuru_fundraise_notice_sw',
            body_default = E'Tunapenda kukufahamisha kuwa:\n\n{{2}}',
            protected_prefix = 'Habari {{1}}',
            protected_suffix = 'Kwa maswali, wasiliana na mwandaaji moja kwa moja.'
        WHERE code = 'fundraise_attend_sw';
    """)


def downgrade() -> None:
    op.execute(r"""
        UPDATE event_reminder_templates
        SET whatsapp_template_name = 'nuru_fundraise_attend_en',
            body_default = E'You have received a new fundraising message from your organiser. Please read it carefully below.\n\n{{2}}\n\nThank you for being part of this community and for the support you continue to give.',
            protected_prefix = 'Hello {{1}},',
            protected_suffix = 'Nuru'
        WHERE code = 'fundraise_attend_en';
    """)
    op.execute(r"""
        UPDATE event_reminder_templates
        SET whatsapp_template_name = 'nuru_fundraise_attend_sw',
            body_default = E'Umepokea ujumbe mpya wa kuchangisha kutoka kwa mwandalizi wako. Tafadhali soma kwa makini hapa chini.\n\n{{2}}\n\nAsante kwa kuwa sehemu ya jumuiya hii na kwa msaada unaoendelea kutoa.',
            protected_prefix = 'Habari {{1}},',
            protected_suffix = 'Nuru'
        WHERE code = 'fundraise_attend_sw';
    """)
