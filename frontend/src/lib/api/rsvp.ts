/**
 * Public RSVP API — no authentication required
 */
import type { ApiResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function publicRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const json = await response.json().catch(() => null);
    if (json && typeof json === "object" && "success" in json) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ("data" in (json as any) ? json : { ...(json as any), data: null }) as ApiResponse<T>;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (json as any)?.message || (response.ok ? "" : "Something went wrong.");
    return { success: response.ok, message, data: json as T };
  } catch {
    return { success: false, message: "Unable to connect. Please check your internet connection.", data: null as T };
  }
}

export interface RSVPData {
  invitation: {
    id: string;
    code: string;
    rsvp_status: string;
    guest_name: string;
    guest_type: string;
  };
  event: {
    id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    location: string | null;
    dress_code: string | null;
    special_instructions: string | null;
    image_url: string | null;
    organizer_name: string;
  };
  settings: {
    allow_plus_ones: boolean;
    max_plus_ones: number;
    require_meal_preference: boolean;
    meal_options: string[];
  };
  current_response: {
    rsvp_status: string;
    meal_preference: string | null;
    dietary_restrictions: string | null;
    special_requests: string | null;
    plus_ones: { name: string; email?: string; phone?: string; meal_preference?: string }[];
  } | null;
}

export interface RSVPResponseBody {
  rsvp_status: "confirmed" | "declined";
  meal_preference?: string;
  dietary_restrictions?: string;
  special_requests?: string;
}

export const rsvpApi = {
  getDetails: (code: string) => publicRequest<RSVPData>(`/rsvp/${encodeURIComponent(code)}`),
  respond: (code: string, body: RSVPResponseBody) =>
    publicRequest(`/rsvp/${encodeURIComponent(code)}/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
