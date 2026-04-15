/**
 * Meeting Agenda & Minutes API
 */

import { get, post, put, del } from "./helpers";

export interface AgendaItem {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  presenter: { id: string; name: string; avatar_url: string | null } | null;
  sort_order: number;
  is_completed: boolean;
  created_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface MeetingMinutesData {
  id: string;
  meeting_id: string;
  content: string;
  summary: string | null;
  decisions: string | null;
  action_items: string | null;
  is_published: boolean;
  recorded_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

const base = (eventId: string, meetingId: string) =>
  `/events/${eventId}/meetings/${meetingId}`;

export const meetingDocsApi = {
  // Agenda
  listAgenda: (eventId: string, meetingId: string) =>
    get(`${base(eventId, meetingId)}/agenda`),

  createAgendaItem: (eventId: string, meetingId: string, data: {
    title: string;
    description?: string;
    duration_minutes?: number;
    presenter_user_id?: string;
    sort_order?: number;
  }) => post(`${base(eventId, meetingId)}/agenda`, data),

  updateAgendaItem: (eventId: string, meetingId: string, itemId: string, data: {
    title?: string;
    description?: string;
    duration_minutes?: number;
    presenter_user_id?: string;
    sort_order?: number;
    is_completed?: boolean;
  }) => put(`${base(eventId, meetingId)}/agenda/${itemId}`, data),

  deleteAgendaItem: (eventId: string, meetingId: string, itemId: string) =>
    del(`${base(eventId, meetingId)}/agenda/${itemId}`),

  reorderAgenda: (eventId: string, meetingId: string, itemIds: string[]) =>
    post(`${base(eventId, meetingId)}/agenda/reorder`, { item_ids: itemIds }),

  // Minutes
  getMinutes: (eventId: string, meetingId: string) =>
    get(`${base(eventId, meetingId)}/minutes`),

  createMinutes: (eventId: string, meetingId: string, data: {
    content: string;
    summary?: string;
    decisions?: string;
    action_items?: string;
  }) => post(`${base(eventId, meetingId)}/minutes`, data),

  updateMinutes: (eventId: string, meetingId: string, data: {
    content?: string;
    summary?: string;
    decisions?: string;
    action_items?: string;
    is_published?: boolean;
  }) => put(`${base(eventId, meetingId)}/minutes`, data),

  deleteMinutes: (eventId: string, meetingId: string) =>
    del(`${base(eventId, meetingId)}/minutes`),
};
