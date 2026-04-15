import { toast as sonnerToast } from "sonner";
import type { ApiResponse } from "./types";

/** Convert snake_case field names to readable labels */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Custom error that carries field-level errors from API responses */
export class ApiError extends Error {
  errors: Array<{ field: string; message: string }>;
  constructor(message: string, errors: Array<{ field: string; message: string }> = []) {
    super(message);
    this.name = "ApiError";
    this.errors = errors;
  }
}

/** Throw an ApiError from a failed response — use in data hooks */
export function throwApiError<T>(response: ApiResponse<T>, fallback = "Something went wrong"): never {
  throw new ApiError(response.message || fallback, response.errors || []);
}

/**
 * Display API error response using sonner toasts.
 * Shows field-level errors one by one if present, otherwise shows the main message.
 * Returns true if there were errors (i.e. success === false).
 */
export function showApiErrors<T>(
  response: ApiResponse<T>,
  fallbackMessage = "Something went wrong. Please try again."
): boolean {
  if (response.success) return false;

  if (response.errors && response.errors.length > 0) {
    response.errors.forEach((err) => {
      const label = err.field
        ? `${formatFieldName(err.field)}: ${err.message}`
        : err.message;
      sonnerToast.error(label);
    });
  } else {
    sonnerToast.error(response.message || fallbackMessage);
  }

  return true;
}

/**
 * Display API error response using shadcn useToast.
 * Returns true if there were errors (i.e. success === false).
 */
export function showApiErrorsShadcn<T>(
  response: ApiResponse<T>,
  toastFn: (opts: { title: string; description?: string; variant?: "destructive" | "default" }) => void,
  fallbackTitle = "Error",
  fallbackMessage = "Something went wrong. Please try again."
): boolean {
  if (response.success) return false;

  if (response.errors && response.errors.length > 0) {
    response.errors.forEach((err) => {
      toastFn({
        title: err.field ? formatFieldName(err.field) : fallbackTitle,
        description: err.message,
        variant: "destructive",
      });
    });
  } else {
    toastFn({
      title: fallbackTitle,
      description: response.message || fallbackMessage,
      variant: "destructive",
    });
  }

  return true;
}

/**
 * Show errors from a caught error (ApiError or plain Error) using sonner.
 * Use in component catch blocks to display field-level errors from thrown ApiErrors.
 */
export function showCaughtError(err: unknown, fallbackMessage = "An unexpected error occurred."): void {
  if (err instanceof ApiError && err.errors.length > 0) {
    err.errors.forEach((e) => {
      const label = e.field ? `${formatFieldName(e.field)}: ${e.message}` : e.message;
      sonnerToast.error(label);
    });
  } else {
    const msg = err instanceof Error ? err.message : fallbackMessage;
    sonnerToast.error(msg);
  }
}

/**
 * Show errors from a caught error using shadcn toast.
 */
export function showCaughtErrorShadcn(
  err: unknown,
  toastFn: (opts: { title: string; description?: string; variant?: "destructive" | "default" }) => void,
  fallbackTitle = "Error",
  fallbackMessage = "An unexpected error occurred."
): void {
  if (err instanceof ApiError && err.errors.length > 0) {
    err.errors.forEach((e) => {
      toastFn({
        title: e.field ? formatFieldName(e.field) : fallbackTitle,
        description: e.message,
        variant: "destructive",
      });
    });
  } else {
    const msg = err instanceof Error ? err.message : fallbackMessage;
    toastFn({ title: fallbackTitle, description: msg, variant: "destructive" });
  }
}
