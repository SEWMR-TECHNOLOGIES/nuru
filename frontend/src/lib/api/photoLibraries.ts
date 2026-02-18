/**
 * Photo Libraries API
 */

import { get, post, del, postFormData, putFormData } from "./helpers";

export interface PhotoLibrary {
  id: string;
  user_service_id: string;
  event_id: string;
  name: string;
  description?: string;
  privacy: "public" | "event_creator_only";
  share_token: string;
  share_url: string;
  photo_count: number;
  total_size_bytes: number;
  total_size_mb: number;
  storage_limit_mb: number;
  storage_used_percent: number;
  event?: {
    id: string;
    name: string;
    start_date?: string;
    location?: string;
    cover_image_url?: string;
    organizer_id?: string;
  };
  service?: { id: string; title: string };
  photos: PhotoLibraryImage[];
  created_at?: string;
  updated_at?: string;
}

export interface PhotoLibraryImage {
  id: string;
  url: string;
  original_name?: string;
  file_size_bytes: number;
  caption?: string;
  display_order: number;
  created_at?: string;
}

export interface ServiceConfirmedEvent {
  event_service_id: string;
  event_id: string;
  event_name: string;
  event_date?: string;
  event_date_display?: string;
  location?: string;
  cover_image_url?: string;
  status: string;
  agreed_price?: number;
  timing: "today" | "upcoming" | "completed";
  organizer_id?: string;
  organizer_name?: string;
  organizer_avatar?: string;
  photo_library?: PhotoLibrary | null;
  has_library: boolean;
}

export const photoLibrariesApi = {
  /** Get all libraries for a service */
  getServiceLibraries: (serviceId: string) =>
    get<{
      libraries: PhotoLibrary[];
      total_libraries: number;
      storage_used_bytes: number;
      storage_used_mb: number;
      storage_limit_mb: number;
      storage_remaining_mb: number;
    }>(`/photo-libraries/service/${serviceId}`),

  /** Get a single library with photos */
  getLibrary: (libraryId: string) =>
    get<PhotoLibrary>(`/photo-libraries/${libraryId}`),

  /** Access library via share token */
  getLibraryByToken: (token: string) =>
    get<PhotoLibrary>(`/photo-libraries/shared/${token}`),

  /** Create a photo library for a confirmed event */
  createLibrary: (serviceId: string, data: { event_id: string; privacy?: string; description?: string }) => {
    const formData = new FormData();
    formData.append("event_id", data.event_id);
    if (data.privacy) formData.append("privacy", data.privacy);
    if (data.description) formData.append("description", data.description);
    return postFormData<PhotoLibrary>(`/photo-libraries/service/${serviceId}/create`, formData);
  },

  /** Update library settings */
  updateLibrary: (libraryId: string, data: { privacy?: string; description?: string }) => {
    const formData = new FormData();
    if (data.privacy) formData.append("privacy", data.privacy);
    if (data.description !== undefined) formData.append("description", data.description);
    return putFormData<PhotoLibrary>(`/photo-libraries/${libraryId}`, formData);
  },

  /** Upload a single photo to a library */
  uploadPhoto: (libraryId: string, file: File, caption?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (caption) formData.append("caption", caption);
    return postFormData<PhotoLibraryImage & { storage_used_mb: number }>(`/photo-libraries/${libraryId}/upload`, formData);
  },

  /** Delete a photo */
  deletePhoto: (libraryId: string, photoId: string) =>
    del(`/photo-libraries/${libraryId}/photos/${photoId}`),

  /** Delete an entire library */
  deleteLibrary: (libraryId: string) =>
    del(`/photo-libraries/${libraryId}`),

  /** Get confirmed events for a service */
  getServiceEvents: (serviceId: string) =>
    get<{ events: ServiceConfirmedEvent[]; total: number; service_title: string }>(
      `/photo-libraries/service/${serviceId}/events`
    ),

  /** Get photo libraries for an event (for event creator) */
  getEventLibraries: (eventId: string) =>
    get<{ libraries: PhotoLibrary[]; total: number }>(`/photo-libraries/event/${eventId}`),
};
