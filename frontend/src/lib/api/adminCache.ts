/**
 * Module-level caches for admin pages — same pattern as workspace useSocial.ts
 * Prevents re-fetching when navigating between sidebar items.
 */

type CacheEntry<T> = { data: T; loaded: boolean };

function makeCache<T>(initial: T): CacheEntry<T> & { set: (d: T) => void; reset: () => void } {
  const entry: any = { data: initial, loaded: false };
  entry.set = (d: T) => { entry.data = d; entry.loaded = true; };
  entry.reset = () => { entry.data = initial; entry.loaded = false; };
  return entry;
}

export const adminCaches = {
  users:              makeCache<any[]>([]),
  services:           makeCache<any[]>([]),
  events:             makeCache<any[]>([]),
  kyc:                makeCache<any[]>([]),
  posts:              makeCache<any[]>([]),
  moments:            makeCache<any[]>([]),
  communities:        makeCache<any[]>([]),
  bookings:           makeCache<any[]>([]),
  nuruCards:          makeCache<any[]>([]),
  chats:              makeCache<any[]>([]),
  tickets:            makeCache<any[]>([]),
  faqs:               makeCache<any[]>([]),
  eventTypes:         makeCache<any[]>([]),
  serviceCategories:  makeCache<any[]>([]),
  admins:             makeCache<any[]>([]),
  userVerifications:  makeCache<any[]>([]),
  issues:             makeCache<any[]>([]),
  issueCategories:    makeCache<any[]>([]),
  pagination:         {} as Record<string, any>,
};
