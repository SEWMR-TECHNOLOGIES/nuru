/**
 * Shared admin-side fetch helpers.
 *
 * All admin endpoints (mounted under /admin/...) require the dedicated
 * `admin_token` set on /admin/login. Using the regular `./helpers` module
 * would attach the user's `access_token`, which the backend correctly
 * rejects with 403 "Not an admin token".
 */
import type { ApiResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function adminRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("admin_token");
  const url = `${BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };
  try {
    const res = await fetch(url, config);
    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/admin/login";
    }
    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && "success" in json) {
      return json as ApiResponse<T>;
    }
    return {
      success: res.ok,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message: (json as any)?.message ?? (res.ok ? "" : "Request failed"),
      data: json as T,
    };
  } catch {
    return { success: false, message: "Network error", data: null as T };
  }
}

export const adminGet = <T>(ep: string) => adminRequest<T>(ep, { method: "GET" });
export const adminPost = <T>(ep: string, body?: unknown) =>
  adminRequest<T>(ep, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const adminPatch = <T>(ep: string, body?: unknown) =>
  adminRequest<T>(ep, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const adminPut = <T>(ep: string, body?: unknown) =>
  adminRequest<T>(ep, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const adminDel = <T>(ep: string) => adminRequest<T>(ep, { method: "DELETE" });
