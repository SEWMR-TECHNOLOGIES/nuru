import type { ApiResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface DeletionRequestPayload {
  full_name: string;
  email: string;
  phone?: string;
  reason?: string;
  delete_scope?: "account_and_data" | "data_only";
  source?: string;
}

export const accountDeletionApi = {
  async submit(payload: DeletionRequestPayload): Promise<ApiResponse<{ id: string }>> {
    try {
      const res = await fetch(`${BASE_URL}/account-deletion/submit`, {
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