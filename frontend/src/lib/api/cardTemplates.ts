/**
 * Invitation Card Templates API
 */

import { get, post, put, del, postFormData } from "./helpers";

export interface InvitationCardTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  pdf_url: string;
  thumbnail_url?: string;
  name_placeholder_x: number;
  name_placeholder_y: number;
  name_font_size: number;
  name_font_color: string;
  qr_placeholder_x: number;
  qr_placeholder_y: number;
  qr_size: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCardTemplatePayload {
  name: string;
  description?: string;
  name_placeholder_x?: number;
  name_placeholder_y?: number;
  name_font_size?: number;
  name_font_color?: string;
  qr_placeholder_x?: number;
  qr_placeholder_y?: number;
  qr_size?: number;
}

export interface UpdateCardTemplatePayload extends Partial<CreateCardTemplatePayload> {
  is_active?: boolean;
}

export const cardTemplatesApi = {
  /** List all card templates for the current user */
  getAll: () =>
    get<InvitationCardTemplate[]>("/card-templates"),

  /** Get a single card template */
  getById: (id: string) =>
    get<InvitationCardTemplate>(`/card-templates/${id}`),

  /** Upload a new card template (PDF + metadata) */
  create: (data: CreateCardTemplatePayload, pdfFile: File) => {
    const formData = new FormData();
    formData.append("pdf", pdfFile);
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value));
    });
    return postFormData<InvitationCardTemplate>("/card-templates", formData);
  },

  /** Update card template metadata */
  update: (id: string, data: UpdateCardTemplatePayload) =>
    put<InvitationCardTemplate>(`/card-templates/${id}`, data),

  /** Delete a card template */
  delete: (id: string) =>
    del<void>(`/card-templates/${id}`),

  /** Assign a card template to an event */
  assignToEvent: (eventId: string, templateId: string | null) =>
    put<void>(`/events/${eventId}/card-template`, { card_template_id: templateId }),

  /** Get the card template assigned to an event */
  getEventTemplate: (eventId: string) =>
    get<InvitationCardTemplate | null>(`/events/${eventId}/card-template`),

  /** Download a filled invitation card PDF for a specific guest */
  downloadFilledCard: (eventId: string, attendeeId: string) =>
    get<{ pdf_url: string }>(`/events/${eventId}/invitation-card/${attendeeId}/download`),
};
