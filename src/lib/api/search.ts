/**
 * Search API - Global search across people, events, and services
 */

import { get, buildQueryString } from "./helpers";

export interface SearchPerson {
  id: string;
  username: string;
  full_name: string;
  avatar: string | null;
  is_verified: boolean;
}

export interface SearchEvent {
  id: string;
  title: string;
  start_date: string;
  location?: string;
  cover_image?: string;
  images?: Array<{ image_url?: string; url?: string; is_featured?: boolean }>;
  status?: string;
  event_type?: { name?: string };
}

export interface SearchService {
  id: string;
  title: string;
  description?: string;
  location?: string;
  rating?: number;
  primary_image?: string;
  verification_status?: string;
  verified?: boolean;
  category_name?: string;
  service_category?: { name?: string };
  service_type_name?: string;
  images?: Array<{ url?: string; image_url?: string; is_primary?: boolean }>;
  min_price?: number;
  max_price?: number;
  currency?: string;
}

export interface GlobalSearchResults {
  people: SearchPerson[];
  events: SearchEvent[];
  services: SearchService[];
}

export const searchApi = {
  /**
   * Search people
   */
  searchPeople: (q: string, limit = 5) =>
    get<{ items: SearchPerson[]; pagination: any }>(`/users/search${buildQueryString({ q, limit })}`),

  /**
   * Search events
   */
  searchEvents: (q: string, limit = 5) =>
    get<{ events: SearchEvent[]; pagination: any }>(`/events${buildQueryString({ q, limit })}`),

  /**
   * Search services
   */
  searchServices: (q: string, limit = 5) =>
    get<{ services: SearchService[]; pagination: any }>(`/services${buildQueryString({ q, limit })}`),

  /**
   * Global search - fires all three in parallel
   */
  globalSearch: async (q: string, limit = 5): Promise<GlobalSearchResults> => {
    const [peopleRes, eventsRes, servicesRes] = await Promise.all([
      searchApi.searchPeople(q, limit),
      searchApi.searchEvents(q, limit),
      searchApi.searchServices(q, limit),
    ]);

    return {
      people: peopleRes.success ? (peopleRes.data?.items || []) : [],
      events: eventsRes.success ? (eventsRes.data?.events || []) : [],
      services: servicesRes.success ? (servicesRes.data?.services || []) : [],
    };
  },
};
