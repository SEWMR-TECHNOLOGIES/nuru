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
import { get, post, put } from "./helpers";

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
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/v1";
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

  sendToContributors: (
    eventId: string,
    category: string,
    contributorIds: string[],
  ) =>
    post<{ queued: number }>(
      `/events/${eventId}/cards/${encodeURIComponent(category)}/send`,
      { contributor_ids: contributorIds },
    ),

  /** Direct URL helpers (these endpoints return image bytes, not JSON). */
  previewPngUrl: (eventId: string, category: string, opts?: { contributorId?: string; width?: number }) => {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/v1";
    const qs = new URLSearchParams();
    if (opts?.contributorId) qs.set("contributor_id", opts.contributorId);
    if (opts?.width) qs.set("width", String(opts.width));
    const suffix = qs.toString() ? `?${qs}` : "";
    return `${base}/events/${eventId}/cards/${encodeURIComponent(category)}/preview.png${suffix}`;
  },
};
