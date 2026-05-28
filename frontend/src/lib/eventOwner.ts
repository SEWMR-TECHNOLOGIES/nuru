/**
 * Frontend display helper for the "event owner" concept.
 *
 * Backend serializers already populate `organizer_name` using the central
 * `get_event_owner_display_name()` helper (recognizable name → owner full
 * name → creator fallback). This wrapper exists so components that fall
 * back to nested fields stay consistent with the same priority.
 *
 * For admin views that need the *creator* account, read `event.organizer.*`
 * directly — do NOT use this helper.
 */
export type EventOwnerLike = {
  recognizable_event_owner_name?: string | null;
  organizer_name?: string | null;
  organizer?: { name?: string | null; first_name?: string | null; last_name?: string | null } | null;
  event_owner?: { name?: string | null; first_name?: string | null; last_name?: string | null } | null;
};

const joinName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(" ").trim();

export const getEventOwnerName = (event: EventOwnerLike | null | undefined): string => {
  if (!event) return "";
  const recognizable = (event.recognizable_event_owner_name || "").trim();
  if (recognizable) return recognizable;

  const direct = (event.organizer_name || "").trim();
  if (direct) return direct;

  const ownerNested =
    event.event_owner?.name?.trim() ||
    joinName(event.event_owner?.first_name, event.event_owner?.last_name);
  if (ownerNested) return ownerNested;

  const organizerNested =
    event.organizer?.name?.trim() ||
    joinName(event.organizer?.first_name, event.organizer?.last_name);
  return organizerNested || "";
};
