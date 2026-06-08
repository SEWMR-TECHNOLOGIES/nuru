/**
 * Bulk member imports (committee + guests).
 *
 * Backed by backend/app/api/routes/user_events.py — the file is parsed there
 * (CSV / XLSX), a MemberImportJob row is created, and the worker in
 * backend/app/tasks/member_imports.py normalises phones, dedupes by phone,
 * and assigns members to the committee or guest list.
 */
import { post, get, resolveApiBaseUrl } from "./helpers";

export type MemberImportMode = "committee" | "guests";

export interface MemberImportJob {
  job_id: string;
  mode: MemberImportMode;
  status: "queued" | "processing" | "completed" | "failed" | string;
  notify_sms: boolean;
  total_rows: number;
  processed_rows: number;
  summary: {
    total: number;
    successful: number;
    reused: number;
    duplicates: number;
    invalid_phone: number;
    failed: number;
  };
  errors?: Array<{ row?: number; reason?: string; phone?: string; name?: string }>;
  started_at?: string | null;
  finished_at?: string | null;
}

async function uploadImportFile(
  eventId: string,
  mode: MemberImportMode,
  file: File,
  notifySms: boolean,
) {
  const base = resolveApiBaseUrl();
  const helpers: any = await import("./helpers");
  const authHeaders =
    (typeof helpers.getAuthHeaders === "function" ? await helpers.getAuthHeaders() : null) || {};
  const fd = new FormData();
  fd.append("file", file);
  fd.append("notify_sms", String(notifySms));
  const path = mode === "committee" ? "committee/import" : "guests/import";
  const resp = await fetch(`${base}/user-events/${eventId}/${path}`, {
    method: "POST",
    headers: { ...authHeaders },
    body: fd,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.message || `Import upload failed (${resp.status})`);
  }
  return json?.data ?? json;
}

export const memberImportsApi = {
  importCommittee: (eventId: string, file: File, notifySms: boolean) =>
    uploadImportFile(eventId, "committee", file, notifySms),

  importGuests: (eventId: string, file: File, notifySms: boolean) =>
    uploadImportFile(eventId, "guests", file, notifySms),

  getJob: (eventId: string, jobId: string) =>
    get<MemberImportJob>(`/user-events/${eventId}/imports/${jobId}`),
};
