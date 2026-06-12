/**
 * WhatsApp Logs API
 * -----------------
 * Every outgoing WhatsApp attempt the backend makes is recorded in
 * `wa_message_logs`. These helpers power the user-facing WhatsApp Logs
 * dashboard so silent delivery failures become visible.
 */
import { get, post, buildQueryString } from "./helpers";
import type { ApiResponse, PaginatedResponse } from "./types";

export type WaLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "rejected"
  | "pending"
  | "unknown";

export interface WaLog {
  id: string;
  recipient_phone: string;
  normalized_phone: string | null;
  user_id: string | null;
  event_id: string | null;
  category: string;
  action: string | null;
  template_name: string | null;
  message_type: string;
  language: string | null;
  direction: string;
  summary: string | null;
  media_url: string | null;
  media_type: string | null;
  provider: string;
  provider_message_id: string | null;
  status: WaLogStatus;
  error_code: string | null;
  error_message: string | null;
  failure_reason: string | null;
  retry_count: number;
  parent_log_id: string | null;
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  retryable: boolean;
}

export interface WaLogDetail extends WaLog {
  request_payload: any;
  response_payload: any;
  webhook_payload: any;
  history: WaLog[];
}

export interface WaLogQuery {
  page?: number;
  limit?: number;
  status?: string;            // comma-separated allowed
  category?: string;          // comma-separated allowed
  message_type?: string;
  template_name?: string;
  event_id?: string;
  recipient?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
}

export function listWhatsappLogs(params: WaLogQuery = {}): Promise<PaginatedResponse<WaLog>> {
  return get<WaLog[]>(`/whatsapp/logs${buildQueryString(params)}`) as unknown as Promise<PaginatedResponse<WaLog>>;
}

export function getWhatsappLogStats(days = 7): Promise<ApiResponse<Record<string, number>>> {
  return get<Record<string, number>>(`/whatsapp/logs/stats?days=${days}`);
}

export function getWhatsappLog(id: string): Promise<ApiResponse<WaLogDetail>> {
  return get<WaLogDetail>(`/whatsapp/logs/${id}`);
}

export function resendWhatsappLog(id: string): Promise<ApiResponse<WaLog>> {
  return post<WaLog>(`/whatsapp/logs/${id}/resend`, {});
}
