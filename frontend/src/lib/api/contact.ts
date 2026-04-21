import type { ApiResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface ContactSubmission {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  source_page?: string;
}

export const contactApi = {
  async submit(payload: ContactSubmission): Promise<ApiResponse<{ id: string }>> {
    try {
      const res = await fetch(`${BASE_URL}/contact/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (json && typeof json === "object" && "success" in json) {
        return json as ApiResponse<{ id: string }>;
      }
      return { success: false, message: "Unexpected server response", data: null } as ApiResponse<{ id: string }>;
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Network error",
        data: null,
      } as ApiResponse<{ id: string }>;
    }
  },
};
