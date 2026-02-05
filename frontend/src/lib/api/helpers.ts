/**
 * API Helpers - Shared utilities for making API requests
 */

import type { ApiResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Get authorization headers with token if available
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Generic fetch wrapper with error handling
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: "include",
  };

  const response = await fetch(url, config);

  // Our backend is not fully consistent:
  // - Most endpoints return { success, message, data }
  // - Some endpoints return just the raw object (e.g. /auth/me)
  // - Some endpoints return { success, message } without data (e.g. /auth/logout)
  // Normalize everything into the ApiResponse<T> shape so the rest of the app stays stable.
  const json = await response.json().catch(() => null);

  if (json && typeof json === "object" && "success" in json) {
    // Ensure data key exists to avoid undefined access downstream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = ("data" in (json as any) ? json : { ...(json as any), data: null }) as ApiResponse<T>;
    return normalized;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = (json as any)?.message || (response.ok ? "" : "Request failed");

  return {
    success: response.ok,
    message,
    data: json as T,
  };
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { method: "GET" });
}

/**
 * POST request
 */
export async function post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request
 */
export async function put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request
 */
export async function patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function del<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { 
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * POST with FormData (for file uploads)
 */
export async function postFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("token");
  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: formData,
  });
  
  return response.json();
}

/**
 * PUT with FormData (for file uploads)
 */
export async function putFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("token");
  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: formData,
  });
  
  return response.json();
}

/**
 * Build query string from params object
 * Accepts any object to avoid strict type checking issues with optional properties
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildQueryString(params?: any): string {
  if (!params) return "";
  
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}
