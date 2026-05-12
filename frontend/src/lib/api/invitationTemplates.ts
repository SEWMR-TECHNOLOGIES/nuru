/**
 * Invitation Card Designer Templates API (web ⇄ mobile shared)
 */
import { get, post, put, del } from "./helpers";

export interface CardCanvas {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImageUrl?: string | null;
}

export type CardLayerType = "text" | "image" | "shape" | "qr";

export interface BaseLayer {
  id: string;
  type: CardLayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;            // may contain {{placeholders}}
  placeholder?: string;    // exact placeholder shorthand for inserts
  wrap?: boolean;
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: "normal" | "italic";
    color?: string;
    textAlign?: "left" | "center" | "right";
    lineHeight?: number;
    letterSpacing?: number;
    backgroundColor?: string | null;
    shadowColor?: string | null;
    shadowBlur?: number;
  };
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  src: string;
  fit?: "cover" | "contain" | "fill";
  borderRadius?: number;
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: "rect" | "circle" | "line";
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number;
  };
}

export interface QrLayer extends BaseLayer {
  type: "qr";
  placeholder: "{{qr_code}}";
  style: {
    foregroundColor?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
}

export type CardLayer = TextLayer | ImageLayer | ShapeLayer | QrLayer;

export interface CardDesignDoc {
  version: number;
  platform: "web" | "mobile";
  canvas: CardCanvas;
  layers: CardLayer[];
}

export interface InvitationCardTemplate {
  id: string;
  event_id: string;
  organizer_id: string;
  name: string;
  design_json: CardDesignDoc;
  preview_image_url: string | null;
  is_active: boolean;
  canvas_width: number;
  canvas_height: number;
  status: "draft" | "published" | "archived";
  platform: "web" | "mobile";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GuestCardData {
  template: InvitationCardTemplate | null;
  context: {
    guest_name: string;
    event_title: string;
    event_date: string;
    event_time: string;
    event_location: string;
    organizer_name: string;
    invite_code: string;
  };
  qr_payload: string;
}

export const invitationTemplatesApi = {
  list: (eventId: string) =>
    get<InvitationCardTemplate[]>(`/events/${eventId}/invitation-templates`),
  active: (eventId: string) =>
    get<InvitationCardTemplate | null>(`/events/${eventId}/invitation-templates/active`),
  create: (eventId: string, body: Partial<InvitationCardTemplate> & { name: string; design_json: CardDesignDoc; canvas_width: number; canvas_height: number; preview_image_url?: string | null }) =>
    post<InvitationCardTemplate>(`/events/${eventId}/invitation-templates`, body),
  update: (eventId: string, templateId: string, body: Partial<InvitationCardTemplate>) =>
    put<InvitationCardTemplate>(`/events/${eventId}/invitation-templates/${templateId}`, body),
  activate: (eventId: string, templateId: string) =>
    post<InvitationCardTemplate>(`/events/${eventId}/invitation-templates/${templateId}/activate`, {}),
  duplicate: (eventId: string, templateId: string) =>
    post<InvitationCardTemplate>(`/events/${eventId}/invitation-templates/${templateId}/duplicate`, {}),
  remove: (eventId: string, templateId: string) =>
    del<{ id: string }>(`/events/${eventId}/invitation-templates/${templateId}`),
  guestCard: (inviteId: string) =>
    get<GuestCardData>(`/invites/${inviteId}/card`),
};
