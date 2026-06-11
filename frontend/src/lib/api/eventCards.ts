/**
 * Event Cards API — thank-you/pledge card templates, per-event edits, and
 * delivery to contributors. Backed by backend/app/api/routes/event_cards.py.
 *
 * Storage model: master SVG templates live on disk (system storage). Each
 * event saves its own edited text values in event_cards.custom_text_values;
 * the final SVG/PNG is rendered on demand by applying those values to the
 * master template. The contributor name placeholder is only substituted at
 * delivery time, never at edit time.
 */
import { get, post, put, postFormData, resolveApiBaseUrl } from "./helpers";

export interface SentCardTemplateSummary {
  template_id: string;
  event_card_id: string;
  slug: string;
  name: string;
  category: string;
  thumbnail_url?: string | null;
  recipient_count: number;
  total_sends: number;
  last_sent_at?: string | null;
}

export type WhatsAppStatus = "on_whatsapp" | "not_on_whatsapp" | "unknown";

export interface SentCardRecipient {
  sent_id: string;
  /** Originating contributor row id (null for guest cards). */
  contributor_id?: string | null;
  /** Originating event_attendee row id (null for contributor cards). */
  guest_attendee_id?: string | null;
  recipient_name: string;
  recipient_phone?: string | null;
  rendered_card_url?: string | null;
  sent_at?: string | null;
  delivery_status?: string | null;
  delivery_channel?: string | null;
  whatsapp_status: WhatsAppStatus;
}

export interface PreparedCard {
  sent_id: string;
  recipient_type: "guest" | "contributor";
  recipient_id: string;
  recipient_name: string;
  recipient_phone?: string | null;
  rendered_card_url?: string | null;
  category?: string | null;
  template_id?: string | null;
  template_slug?: string | null;
  template_name?: string | null;
  prepared_at?: string | null;
}





export interface CardCategory {
  category: string;
  name: string;
  description?: string;
  template_count: number;
}

export interface CardEditableField {
  id: string;
  label: string;
  max_length?: number;
  multiline?: boolean;
  default?: string;
}

/** Convert backend-relative `/api/v1/...` asset paths into absolute URLs that
 *  honour `VITE_API_BASE_URL` (cross-origin dev backends, NGINX prod, etc). */
export const absolutizeApiUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const base = resolveApiBaseUrl();
  const stripped = path.replace(/^\/api\/v1/, "");
  return `${base}${stripped}`;
};

export interface CardTemplateMetadata {
  name?: string;
  slug?: string;
  category?: string;
  description?: string;
  contributor_placeholder_id?: string;
  locked_ids?: string[];
  editable_fields?: CardEditableField[];
  fonts?: string[];
  qr_placement?: { x: number; y: number; width: number; height: number };
  view_box?: { width: number; height: number };
  preserve_text_positions?: boolean;
  replace_defaults_in_preview?: boolean;
  recipient_noun?: string;
  /** "contributors" (thank-you cards, default) or "guests" (invitation cards). */
  recipient_source?: "contributors" | "guests";
  /** When recipient_source === "guests", which RSVP buckets are eligible. */
  recipient_filter?: Array<"pending" | "confirmed" | "declined" | "maybe">;
}


export interface CardTemplateSummary {
  id: string | null;
  slug: string;
  name: string;
  description?: string;
  category: string;
  svg_file: string;
  thumbnail_file?: string | null;
  svg_url: string;
  thumbnail_url?: string | null;
}

export interface CardTemplateDetail {
  id: string;
  slug: string;
  category: string;
  name: string;
  metadata: CardTemplateMetadata;
  svg: string;
}

export interface SavedEventCard {
  id: string;
  category: string;
  card_template_id: string;
  card_template_slug?: string | null;
  card_template_name?: string | null;
  custom_text_values: Record<string, string>;
  updated_at?: string | null;
}

export const eventCardsApi = {
  listCategories: () =>
    get<{ categories: CardCategory[] }>(`/cards/categories`),

  listTemplates: (category: string) =>
    get<{ category: string; templates: CardTemplateSummary[] }>(
      `/cards/categories/${encodeURIComponent(category)}/templates`,
    ),

  getTemplate: (slug: string) =>
    get<CardTemplateDetail>(`/cards/templates/${encodeURIComponent(slug)}`),

  listEventCards: (eventId: string) =>
    get<{ event_cards: SavedEventCard[] }>(`/events/${eventId}/cards`),

  saveEventCard: (
    eventId: string,
    payload: {
      category: string;
      card_template_id?: string;
      card_template_slug?: string;
      custom_text_values: Record<string, string>;
    },
  ) => put<SavedEventCard>(`/events/${eventId}/cards`, payload),

  uploadRenderedCard: (eventId: string, category: string, recipientId: string, file: File) => {
    const formData = new FormData();
    formData.append("recipient_id", recipientId);
    formData.append("file", file);
    return postFormData<{ url: string; path: string }>(
      `/events/${eventId}/cards/${encodeURIComponent(category)}/upload-render`,
      formData,
    );
  },

  sendToContributors: (
    eventId: string,
    category: string,
    contributorIds: string[],
    preRenderedImages?: Record<string, string>,
    /** "fresh" (default) resends to every selected recipient.
     *  "skip_existing" silently drops anyone whose card was already
     *  delivered before, so this becomes a "send only to not-yet-sent". */
    mode?: "fresh" | "skip_existing",
  ) =>
    post<{ queued: number; skipped_existing?: string[] }>(
      `/events/${eventId}/cards/${encodeURIComponent(category)}/send`,
      {
        contributor_ids: contributorIds,
        pre_rendered_images: preRenderedImages || undefined,
        mode: mode || "fresh",
      },
    ),

  /** Invitation cards: browser pre-renders one PNG per guest with that
   *  guest's QR baked in (matches the live preview exactly) and uploads it;
   *  the server reuses those URLs instead of running cairosvg, which strips
   *  the template's custom fonts and decorative styles. */
  sendToGuests: (
    eventId: string,
    category: string,
    guestIds: string[],
    preRenderedImages?: Record<string, string>,
    mode?: "fresh" | "skip_existing",
  ) =>
    post<{ queued: number; skipped_existing?: string[] }>(
      `/events/${eventId}/cards/${encodeURIComponent(category)}/send`,
      {
        guest_ids: guestIds,
        pre_rendered_images: preRenderedImages || undefined,
        mode: mode || "fresh",
      },
    ),

  // ── Prepared Cards (status='prepared' rows). ─────────────────────
  /** Identical to send, but only creates the per-recipient SentEventCard
   *  rows — no WhatsApp/SMS dispatch. Pre-rendered URLs (if provided) are
   *  stashed on the row so the Prepared Cards tab can show thumbnails.
   *
   *  ``mode`` controls duplicate handling:
   *    "fresh"          → re-prepare for every selected recipient,
   *                       overwriting any previously prepared card.
   *    "skip_existing"  → skip recipients who already have a prepared/
   *                       sent card so their stable URL is preserved. */
  prepareForContributors: (
    eventId: string,
    category: string,
    contributorIds: string[],
    preRenderedImages?: Record<string, string>,
    mode?: "fresh" | "skip_existing",
  ) =>
    post<{ prepared: number; sent_ids: string[]; skipped_existing?: string[] }>(
      `/events/${eventId}/cards/${encodeURIComponent(category)}/send`,
      {
        contributor_ids: contributorIds,
        pre_rendered_images: preRenderedImages || undefined,
        prepare_only: true,
        mode: mode || "fresh",
      },
    ),

  prepareForGuests: (
    eventId: string,
    category: string,
    guestIds: string[],
    preRenderedImages?: Record<string, string>,
    mode?: "fresh" | "skip_existing",
  ) =>
    post<{ prepared: number; sent_ids: string[]; skipped_existing?: string[] }>(
      `/events/${eventId}/cards/${encodeURIComponent(category)}/send`,
      {
        guest_ids: guestIds,
        pre_rendered_images: preRenderedImages || undefined,
        prepare_only: true,
        mode: mode || "fresh",
      },
    ),


  listPreparedCards: (eventId: string) =>
    get<{ prepared_cards: PreparedCard[] }>(`/events/${eventId}/prepared-cards`),

  sendPreparedCards: (eventId: string, sentIds: string[]) =>
    post<{ queued: number }>(`/events/${eventId}/prepared-cards/send`, { sent_ids: sentIds }),

  /** Resend cards that were already dispatched at least once — reuses the
   *  stored ``rendered_card_url`` so the recipient sees the same image. */
  resendSentCards: (eventId: string, sentIds: string[]) =>
    post<{ queued: number }>(`/events/${eventId}/sent-cards/resend`, { sent_ids: sentIds }),


  discardPreparedCards: (eventId: string, sentIds: string[]) =>
    post<{ discarded: number }>(`/events/${eventId}/prepared-cards/discard`, { sent_ids: sentIds }),



  // ── Sent Cards browser ────────────────────────────────────────────
  listSentCardTemplates: (eventId: string) =>
    get<{ templates: SentCardTemplateSummary[] }>(`/events/${eventId}/sent-cards/templates`),

  listSentCardRecipients: (eventId: string, templateId: string) =>
    get<{ recipients: SentCardRecipient[] }>(
      `/events/${eventId}/sent-cards/templates/${encodeURIComponent(templateId)}/recipients`,
    ),

  /** Streams a ZIP of PNGs or a combined PDF back to the browser. */
  downloadSentCards: async (
    eventId: string,
    sentIds: string[],
    format: "images" | "pdf",
  ): Promise<{ blob: Blob; filename: string }> => {
    const base = resolveApiBaseUrl();
    const helpers: any = await import("./helpers");
    const authHeaders =
      (typeof helpers.getAuthHeaders === "function" ? await helpers.getAuthHeaders() : null) || {};
    const resp = await fetch(`${base}/events/${eventId}/sent-cards/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ sent_ids: sentIds, format }),
    });
    if (!resp.ok) {
      let detail = `Download failed (${resp.status})`;
      try { const j = await resp.json(); detail = j?.detail || j?.message || detail; } catch {}
      throw new Error(detail);
    }
    const dispo = resp.headers.get("content-disposition") || "";
    const m = dispo.match(/filename="?([^";]+)"?/i);
    const filename = m?.[1] || (format === "pdf" ? "cards.pdf" : "cards.zip");
    const blob = await resp.blob();
    return { blob, filename };
  },



  /** Direct URL helpers (these endpoints return image bytes, not JSON). */
  previewPngUrl: (eventId: string, category: string, opts?: { contributorId?: string; width?: number }) => {
    const base = resolveApiBaseUrl();
    const qs = new URLSearchParams();
    if (opts?.contributorId) qs.set("contributor_id", opts.contributorId);
    if (opts?.width) qs.set("width", String(opts.width));
    const suffix = qs.toString() ? `?${qs}` : "";
    return `${base}/events/${eventId}/cards/${encodeURIComponent(category)}/preview.png${suffix}`;
  },
};
