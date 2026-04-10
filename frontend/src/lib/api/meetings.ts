/**
 * Meetings API - Event video conferencing
 */

import { get, post, put, del } from "./helpers";

export interface MeetingParticipant {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_notified: boolean;
  joined_at: string | null;
}

export interface Meeting {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: string;
  room_id: string;
  meeting_url: string;
  status: "scheduled" | "in_progress" | "ended";
  created_by: { id: string; name: string };
  participants: MeetingParticipant[];
  participant_count: number;
  has_agenda: boolean;
  has_minutes: boolean;
  ended_at: string | null;
  created_at: string;
}

export const meetingsApi = {
  list: (eventId: string) => get(`/events/${eventId}/meetings`),
  get: (eventId: string, meetingId: string) => get(`/events/${eventId}/meetings/${meetingId}`),
  create: (eventId: string, data: {
    title: string;
    description?: string;
    scheduled_at: string;
    duration_minutes?: string;
    participant_user_ids?: string[];
  }) => post(`/events/${eventId}/meetings`, data),
  update: (eventId: string, meetingId: string, data: {
    title?: string;
    description?: string;
    scheduled_at?: string;
    duration_minutes?: string;
  }) => put(`/events/${eventId}/meetings/${meetingId}`, data),
  delete: (eventId: string, meetingId: string) => del(`/events/${eventId}/meetings/${meetingId}`),
  addParticipants: (eventId: string, meetingId: string, userIds: string[]) =>
    post(`/events/${eventId}/meetings/${meetingId}/participants`, { user_ids: userIds }),
  join: (eventId: string, meetingId: string) =>
    post(`/events/${eventId}/meetings/${meetingId}/join`, {}),
  end: (eventId: string, meetingId: string) =>
    post(`/events/${eventId}/meetings/${meetingId}/end`, {}),
  getToken: (eventId: string, meetingId: string) =>
    post(`/events/${eventId}/meetings/${meetingId}/token`, {}),
};
