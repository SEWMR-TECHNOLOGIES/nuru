/**
 * Reminder Automations API client.
 */
import { get, post, patch, del, buildQueryString } from "./helpers";

export type AutomationType = "fundraise_attend" | "pledge_remind" | "guest_remind";
export type LanguageCode = "en" | "sw";
export type ScheduleKind = "now" | "datetime" | "days_before" | "hours_before" | "repeat";

export interface ReminderTemplate {
  id: string;
  code: string;
  automation_type: AutomationType;
  language: LanguageCode;
  whatsapp_template_name: string | null;
  body_default: string;
  placeholders: string[];
  required_placeholders: string[];
  protected_prefix: string;
  protected_suffix: string;
}

export interface ReminderRun {
  id: string;
  automation_id: string;
  trigger: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  finished_at: string | null;
  body_snapshot: string | null;
  error: string | null;
}

export interface ReminderRecipient {
  id: string;
  recipient_type: "contributor" | "guest";
  recipient_id: string;
  name: string | null;
  phone: string | null;
  channel: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  attempts: number;
  error: string | null;
  queued_at: string | null;
  sent_at: string | null;
}

export interface Automation {
  id: string;
  event_id: string;
  automation_type: AutomationType;
  language: LanguageCode;
  name: string | null;
  template: ReminderTemplate | null;
  body_override: string | null;
  schedule_kind: ScheduleKind;
  schedule_at: string | null;
  days_before: number | null;
  hours_before: number | null;
  repeat_interval_hours: number | null;
  min_gap_hours: number;
  timezone: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string | null;
  last_run: ReminderRun | null;
}

export interface CreateAutomationPayload {
  automation_type: AutomationType;
  language: LanguageCode;
  name?: string;
  body_override?: string;
  schedule_kind: ScheduleKind;
  schedule_at?: string;
  days_before?: number;
  hours_before?: number;
  repeat_interval_hours?: number;
  min_gap_hours?: number;
  timezone?: string;
  enabled?: boolean;
}

export const reminderAutomationsApi = {
  listTemplates: (params?: { automation_type?: AutomationType; language?: LanguageCode }) =>
    get<{ items: ReminderTemplate[] }>(`/reminder-templates${buildQueryString(params)}`),

  list: (eventId: string) =>
    get<{ items: Automation[] }>(`/events/${eventId}/automations`),

  create: (eventId: string, payload: CreateAutomationPayload) =>
    post<Automation>(`/events/${eventId}/automations`, payload),

  get: (eventId: string, id: string) =>
    get<Automation>(`/events/${eventId}/automations/${id}`),

  update: (eventId: string, id: string, payload: Partial<CreateAutomationPayload>) =>
    patch<Automation>(`/events/${eventId}/automations/${id}`, payload),

  remove: (eventId: string, id: string) =>
    del(`/events/${eventId}/automations/${id}`),

  enable: (eventId: string, id: string) =>
    post<Automation>(`/events/${eventId}/automations/${id}/enable`, {}),

  disable: (eventId: string, id: string) =>
    post<Automation>(`/events/${eventId}/automations/${id}/disable`, {}),

  preview: (eventId: string, id: string, body_override?: string, language?: LanguageCode) =>
    post<{ rendered: string; channels: string[] }>(
      `/events/${eventId}/automations/${id}/preview`,
      { body_override, language },
    ),

  sendNow: (eventId: string, id: string) =>
    post<{ run_id: string; automation_id: string }>(
      `/events/${eventId}/automations/${id}/send-now`,
      {},
    ),

  listRuns: (eventId: string, id: string, limit = 20) =>
    get<{ items: ReminderRun[] }>(
      `/events/${eventId}/automations/${id}/runs${buildQueryString({ limit })}`,
    ),

  listRecipients: (eventId: string, id: string, runId: string, status?: string) =>
    get<{ run: ReminderRun; items: ReminderRecipient[] }>(
      `/events/${eventId}/automations/${id}/runs/${runId}/recipients${buildQueryString(status ? { status } : undefined)}`,
    ),

  resendFailed: (eventId: string, id: string, runId: string) =>
    post(`/events/${eventId}/automations/${id}/runs/${runId}/resend-failed`, {}),
};
