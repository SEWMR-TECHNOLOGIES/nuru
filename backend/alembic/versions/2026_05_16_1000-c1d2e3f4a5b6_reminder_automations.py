"""reminder automations

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-05-16 10:00:00

Adds the reminder/notification automation system:

* event_reminder_templates    — system-defined catalog of WA + SMS templates
                                 (one row per (automation_type, language)).
                                 Body has fixed protected_prefix/suffix so the
                                 organiser-editable body never sits at the
                                 start or end (WhatsApp template restriction).
* event_reminder_automations  — per-event organiser configuration.
                                 schedule_kind: 'now' | 'datetime' | 'days_before'
                                                | 'hours_before' | 'repeat'.
* event_reminder_runs         — one row per execution (manual or scheduled).
* event_reminder_recipients   — per-recipient delivery log with a UNIQUE
                                 constraint on (run_id, recipient_type,
                                 recipient_id) for idempotency.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b0c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── templates catalog (seeded on first deploy) ──
    op.create_table(
        "event_reminder_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("automation_type", sa.Text(), nullable=False),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("whatsapp_template_name", sa.Text(), nullable=True),
        sa.Column("body_default", sa.Text(), nullable=False),
        sa.Column("placeholders", postgresql.JSONB(), nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("required_placeholders", postgresql.ARRAY(sa.Text()),
                  nullable=False, server_default=sa.text("ARRAY[]::text[]")),
        sa.Column("protected_prefix", sa.Text(), nullable=False,
                  server_default=sa.text("''")),
        sa.Column("protected_suffix", sa.Text(), nullable=False,
                  server_default=sa.text("''")),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "automation_type IN ('fundraise_attend','pledge_remind','guest_remind')",
            name="ck_reminder_templates_automation_type",
        ),
        sa.CheckConstraint(
            "language IN ('en','sw')",
            name="ck_reminder_templates_language",
        ),
        sa.UniqueConstraint("code", name="uq_reminder_templates_code"),
        sa.UniqueConstraint("automation_type", "language",
                            name="uq_reminder_templates_type_lang"),
    )

    # ── per-event automation config ──
    op.create_table(
        "event_reminder_automations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("automation_type", sa.Text(), nullable=False),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_reminder_templates.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("body_override", sa.Text(), nullable=True),
        # schedule_kind: now | datetime | days_before | hours_before | repeat
        sa.Column("schedule_kind", sa.Text(), nullable=False),
        sa.Column("schedule_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("days_before", sa.Integer(), nullable=True),
        sa.Column("hours_before", sa.Integer(), nullable=True),
        sa.Column("repeat_interval_hours", sa.Integer(), nullable=True),
        # User-defined min gap between repeated sends to the same recipient.
        sa.Column("min_gap_hours", sa.Integer(), nullable=False,
                  server_default=sa.text("24")),
        # Organiser timezone snapshot used when computing next_run_at.
        sa.Column("timezone", sa.Text(), nullable=False,
                  server_default=sa.text("'Africa/Nairobi'")),
        sa.Column("enabled", sa.Boolean(), nullable=False,
                  server_default=sa.text("true")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "automation_type IN ('fundraise_attend','pledge_remind','guest_remind')",
            name="ck_reminder_autom_type",
        ),
        sa.CheckConstraint(
            "language IN ('en','sw')",
            name="ck_reminder_autom_language",
        ),
        sa.CheckConstraint(
            "schedule_kind IN ('now','datetime','days_before','hours_before','repeat')",
            name="ck_reminder_autom_schedule_kind",
        ),
    )
    op.create_index("idx_reminder_autom_event",
                    "event_reminder_automations", ["event_id"])
    op.create_index("idx_reminder_autom_next_run",
                    "event_reminder_automations",
                    ["enabled", "next_run_at"])

    # ── execution runs ──
    op.create_table(
        "event_reminder_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("automation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_reminder_automations.id",
                                ondelete="CASCADE"), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger", sa.Text(), nullable=False,
                  server_default=sa.text("'manual'")),
        sa.Column("status", sa.Text(), nullable=False,
                  server_default=sa.text("'pending'")),
        sa.Column("body_snapshot", sa.Text(), nullable=True),
        sa.Column("total_recipients", sa.Integer(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("sent_count", sa.Integer(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("failed_count", sa.Integer(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("skipped_count", sa.Integer(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("started_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','running','completed','failed','cancelled')",
            name="ck_reminder_runs_status",
        ),
        sa.CheckConstraint(
            "trigger IN ('manual','scheduled','resend')",
            name="ck_reminder_runs_trigger",
        ),
    )
    op.create_index("idx_reminder_runs_automation",
                    "event_reminder_runs", ["automation_id", "started_at"])

    # ── per-recipient delivery log ──
    op.create_table(
        "event_reminder_recipients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_reminder_runs.id",
                                ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_type", sa.Text(), nullable=False),  # contributor|guest
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("channel", sa.Text(), nullable=True),  # whatsapp|sms|skipped
        sa.Column("status", sa.Text(), nullable=False,
                  server_default=sa.text("'pending'")),
        sa.Column("provider_ref", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("queued_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        # Per-recipient rendered message body (with personalised variables
        # such as the dynamic share-link, pledge amount and balance).
        sa.Column("message", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','sent','failed','skipped')",
            name="ck_reminder_recipients_status",
        ),
        sa.CheckConstraint(
            "recipient_type IN ('contributor','guest')",
            name="ck_reminder_recipients_type",
        ),
        sa.UniqueConstraint("run_id", "recipient_type", "recipient_id",
                            name="uq_reminder_recipients_run"),
    )
    op.create_index("idx_reminder_recipients_run_status",
                    "event_reminder_recipients", ["run_id", "status"])

    # ── seed the 6 templates (3 types × 2 languages) ──
    # Body wraps the editable {{4}} between fixed prefix/suffix so WA's
    # "no leading/trailing variable" rule is always satisfied at the
    # template level even when the organiser edits the body.
    op.execute("""
        INSERT INTO event_reminder_templates
          (code, automation_type, language, whatsapp_template_name,
           body_default, placeholders, required_placeholders,
           protected_prefix, protected_suffix)
        VALUES
        ('fundraise_attend_en', 'fundraise_attend', 'en',
         'nuru_fundraise_attend_en',
         E'You have received a new fundraising message from your organiser. Please read it carefully below.\n\n{{2}}\n\nThank you for being part of this community and for the support you continue to give.',
         '["recipient_name","body"]'::jsonb,
         ARRAY['body'],
         'Hello {{1}},',
         'Nuru'),

        ('fundraise_attend_sw', 'fundraise_attend', 'sw',
         'nuru_fundraise_attend_sw',
         E'Umepokea ujumbe mpya wa kuchangisha kutoka kwa mwandalizi wako. Tafadhali soma kwa makini hapa chini.\n\n{{2}}\n\nAsante kwa kuwa sehemu ya jumuiya hii na kwa msaada unaoendelea kutoa.',
         '["recipient_name","body"]'::jsonb,
         ARRAY['body'],
         'Habari {{1}},',
         'Nuru'),

        ('pledge_remind_en', 'pledge_remind', 'en',
         'nuru_pledge_remind_en',
         E'This is a friendly reminder about your pending pledge for the event "{{2}}", which is scheduled to take place on {{3}}.\n\nYour total pledge is {{4}} and the outstanding balance still awaited is {{5}}.\n\nYou can complete your contribution at any time before the event date through the secure link below:\n\n{{6}}\n\nThank you for your generosity and continued support.',
         '["recipient_name","event_name","event_datetime","pledge_amount","balance","pay_link"]'::jsonb,
         ARRAY['event_name','event_datetime','pledge_amount','balance','pay_link'],
         'Hello {{1}},',
         'Nuru'),

        ('pledge_remind_sw', 'pledge_remind', 'sw',
         'nuru_pledge_remind_sw',
         E'Hii ni kumbusho la upole kuhusu ahadi yako iliyobaki kwa tukio la "{{2}}", ambalo limepangwa kufanyika tarehe {{3}}.\n\nAhadi yako jumla ni {{4}} na kiasi kilichobaki ni {{5}}.\n\nUnaweza kukamilisha mchango wako wakati wowote kabla ya siku ya tukio kupitia kiungo salama hapa chini:\n\n{{6}}\n\nAsante kwa ukarimu wako na mchango wako endelevu.',
         '["recipient_name","event_name","event_datetime","pledge_amount","balance","pay_link"]'::jsonb,
         ARRAY['event_name','event_datetime','pledge_amount','balance','pay_link'],
         'Habari {{1}},',
         'Nuru'),

        ('guest_remind_en', 'guest_remind', 'en',
         'nuru_guest_remind_en',
         E'This is a friendly reminder that you have been invited to the event "{{2}}", which will take place on {{3}} at {{4}}.\n\nWe truly value your presence and kindly ask you to plan ahead so you do not miss this special occasion. Please arrive on time and feel free to share this reminder with anyone accompanying you.\n\nWe look forward to welcoming you on the day.',
         '["recipient_name","event_name","event_datetime","event_venue"]'::jsonb,
         ARRAY['event_name','event_datetime','event_venue'],
         'Hello {{1}},',
         'Nuru'),

        ('guest_remind_sw', 'guest_remind', 'sw',
         'nuru_guest_remind_sw',
         E'Hii ni kumbusho la upole kwamba umealikwa kwenye tukio la "{{2}}", ambalo litafanyika tarehe {{3}} mahali {{4}}.\n\nUwepo wako ni wa thamani kubwa kwetu na tunakuomba upange ratiba yako mapema ili usikose tukio hili maalum. Tafadhali wahi kufika na unaweza kushiriki ukumbusho huu na yeyote atakayefuatana nawe.\n\nTunatazamia kukukaribisha siku hiyo.',
         '["recipient_name","event_name","event_datetime","event_venue"]'::jsonb,
         ARRAY['event_name','event_datetime','event_venue'],
         'Habari {{1}},',
         'Nuru');
    """)


def downgrade() -> None:
    op.drop_index("idx_reminder_recipients_run_status",
                  table_name="event_reminder_recipients")
    op.drop_table("event_reminder_recipients")
    op.drop_index("idx_reminder_runs_automation",
                  table_name="event_reminder_runs")
    op.drop_table("event_reminder_runs")
    op.drop_index("idx_reminder_autom_next_run",
                  table_name="event_reminder_automations")
    op.drop_index("idx_reminder_autom_event",
                  table_name="event_reminder_automations")
    op.drop_table("event_reminder_automations")
    op.drop_table("event_reminder_templates")
