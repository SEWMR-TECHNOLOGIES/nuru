/**
 * Centralized event cover image resolver.
 *
 * Any event without a server-provided cover/primary image should fall back to
 * the Nuru editorial default (an illustrated calendar/photo/envelope vignette
 * uploaded by the brand team) instead of a generic gray placeholder.
 *
 * Use this anywhere an event card, hero, or thumbnail is rendered so the
 * fallback is consistent across web, share previews, and admin tools.
 */
export const NURU_EVENT_DEFAULT_IMAGE = "/event-default.png";

type AnyEvent = Record<string, any> | null | undefined;

const firstImageFrom = (images: any): string | undefined => {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  // Prefer featured/primary, then fall back to the first usable URL.
  const ranked = [...images].sort((a, b) => {
    const ap = (a?.is_featured || a?.is_primary) ? 0 : 1;
    const bp = (b?.is_featured || b?.is_primary) ? 0 : 1;
    return ap - bp;
  });
  for (const img of ranked) {
    if (typeof img === "string" && img) return img;
    const url = img?.image_url || img?.url || img?.file_url;
    if (typeof url === "string" && url) return url;
  }
  return undefined;
};

/**
 * Returns the best available cover image for an event, or the brand default
 * fallback when none is present.
 */
export const getEventImage = (ev: AnyEvent): string => {
  if (!ev) return NURU_EVENT_DEFAULT_IMAGE;
  return (
    (typeof ev.cover_image === "string" && ev.cover_image) ||
    (typeof ev.event_cover_image_url === "string" && ev.event_cover_image_url) ||
    (typeof ev.image === "string" && ev.image) ||
    (typeof ev.primary_image === "string" && ev.primary_image) ||
    (typeof ev.image_url === "string" && ev.image_url) ||
    firstImageFrom(ev.images) ||
    NURU_EVENT_DEFAULT_IMAGE
  );
};
