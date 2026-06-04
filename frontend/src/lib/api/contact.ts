import type { ApiResponse } from "./types";
import { resolveApiBaseUrl } from "./helpers";

const BASE_URL = resolveApiBaseUrl();

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
