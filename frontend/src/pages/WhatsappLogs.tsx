/**
 * WhatsApp Logs Dashboard Page
 * ----------------------------
 * Lists every WhatsApp message attempt the backend has tried to send
 * (invitations, OTPs, RSVPs, tickets, contributions, vendor bookings,
 * password resets, media, button, plain text). Lets the user filter,
 * inspect, and safely resend failed messages.
 *
 * Mounted at `/whatsapp-logs` inside the authenticated app layout.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Mail,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  listWhatsappLogs,
  getWhatsappLog,
  getWhatsappLogStats,
  resendWhatsappLog,
  type WaLog,
  type WaLogDetail,
  type WaLogStatus,
  type WaLogQuery,
} from "@/lib/api/whatsappLogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { getTimeAgo } from "@/utils/getTimeAgo";

const STATUS_META: Record<
  WaLogStatus | "total",
  { label: string; tone: string; icon: any }
> = {
  queued:    { label: "Queued",    tone: "bg-slate-100 text-slate-700 border-slate-200",   icon: Clock },
  sent:      { label: "Sent",      tone: "bg-sky-50 text-sky-700 border-sky-200",          icon: Mail },
  delivered: { label: "Delivered", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  read:      { label: "Read",      tone: "bg-violet-50 text-violet-700 border-violet-200", icon: Eye },
  failed:    { label: "Failed",    tone: "bg-rose-50 text-rose-700 border-rose-200",       icon: XCircle },
  rejected:  { label: "Rejected",  tone: "bg-amber-50 text-amber-800 border-amber-200",    icon: AlertTriangle },
  pending:   { label: "Pending",   tone: "bg-slate-100 text-slate-700 border-slate-200",   icon: Clock },
  unknown:   { label: "Unknown",   tone: "bg-slate-100 text-slate-700 border-slate-200",   icon: AlertTriangle },
  total:     { label: "Total",     tone: "bg-slate-50 text-slate-700 border-slate-200",    icon: Mail },
};

const CATEGORY_LABEL: Record<string, string> = {
  invitation: "Invitation",
  invitation_card: "Invitation Card",
  otp: "OTP",
  password_reset: "Password Reset",
  account_setup: "Account Setup",
  rsvp: "RSVP",
  contribution: "Contribution",
  committee: "Committee",
  meeting: "Meeting",
  ticket: "Ticket",
  vendor_booking: "Vendor / Booking",
  payment: "Payment",
  reminder: "Reminder",
  expense: "Expense",
  text: "Plain Text",
  template: "Template",
  media: "Media",
  system: "System",
};

const STATUS_OPTIONS: WaLogStatus[] = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "rejected",
  "pending",
  "unknown",
];

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL);

function StatusPill({ status }: { status: WaLogStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function StatCard({ label, count, tone, active, onClick }: { label: string; count: number; tone: string; active?: boolean; onClick?: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-all ${tone} ${active ? "ring-2 ring-offset-1 ring-slate-400" : "hover:shadow-sm"}`}
    >
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{count.toLocaleString()}</div>
    </button>
  );
}

export default function WhatsappLogs() {
  const [filters, setFilters] = useState<WaLogQuery>({ page: 1, limit: 25 });
  const [search, setSearch] = useState("");
  const [recipient, setRecipient] = useState("");
  const [logs, setLogs] = useState<WaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<{ total: number; total_pages: number; current_page: number } | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});

  const [activeLog, setActiveLog] = useState<WaLogDetail | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);

  const [resendTarget, setResendTarget] = useState<WaLog | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const fetchLogs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res: any = await listWhatsappLogs({
        ...filters,
        q: search || undefined,
        recipient: recipient || undefined,
      });
      const payload = res?.data;
      const items: WaLog[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(res?.items)
        ? res.items
        : [];
      const pg = payload?.pagination ?? res?.pagination ?? null;
      setLogs(items);
      setPagination(
        pg
          ? {
              total: pg.total_items ?? pg.total ?? items.length,
              total_pages: pg.total_pages ?? 1,
              current_page: pg.page ?? pg.current_page ?? 1,
            }
          : null,
      );
    } catch (e: any) {
      if (!opts?.silent) {
        toast({ title: "Failed to load WhatsApp logs", description: e?.message ?? "Try again.", variant: "destructive" });
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [filters, search, recipient]);

  const fetchStats = useCallback(async () => {
    try {
      const r = await getWhatsappLogStats(7);
      setStats((r?.data as any) ?? {});
    } catch {/* no-op */}
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Background refresh — silent, no skeleton flicker, no toasts.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchLogs({ silent: true });
      fetchStats();
    }, 20000);
    return () => window.clearInterval(id);
  }, [fetchLogs, fetchStats]);

  const onOpenLog = async (id: string) => {
    setActiveLoading(true);
    setActiveLog({ id } as any);
    try {
      const r = await getWhatsappLog(id);
      if (r?.success) setActiveLog(r.data as WaLogDetail);
    } catch (e: any) {
      toast({ title: "Couldn't load log detail", description: e?.message ?? "", variant: "destructive" });
      setActiveLog(null);
    } finally {
      setActiveLoading(false);
    }
  };

  const onResend = async () => {
    if (!resendTarget) return;
    setResendBusy(true);
    try {
      const r = await resendWhatsappLog(resendTarget.id);
      if (r?.success) {
        toast({ title: "Resend queued", description: "A fresh attempt has been scheduled. The original failure record is kept for audit." });
        setResendTarget(null);
        await Promise.all([fetchLogs(), fetchStats()]);
      } else {
        throw new Error(r?.message || "Resend failed");
      }
    } catch (e: any) {
      toast({ title: "Couldn't resend", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setResendBusy(false);
    }
  };

  const statusFilter = filters.status ?? "";
  const setStatusFilter = (s: string) =>
    setFilters((f) => ({ ...f, status: s || undefined, page: 1 }));

  const statBlocks = useMemo(() => {
    const order: (WaLogStatus | "total")[] = ["total", "delivered", "read", "sent", "queued", "failed", "rejected"];
    return order.map((k) => ({
      key: k,
      label: STATUS_META[k].label,
      tone: STATUS_META[k].tone,
      count: Number(stats[k] || 0),
    }));
  }, [stats]);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6 md:py-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">WhatsApp Logs</h1>
          <p className="text-sm text-slate-500">Every WhatsApp message Nuru tried to send — what worked, what failed, and why.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchLogs(); fetchStats(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {statBlocks.map((s) => (
          <StatCard
            key={s.key}
            label={s.label}
            count={s.count}
            tone={s.tone}
            active={s.key !== "total" && statusFilter === s.key}
            onClick={() => s.key === "total" ? setStatusFilter("") : setStatusFilter(s.key)}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border bg-white p-3">
        <div className="md:col-span-3 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search name, summary, template, error…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setFilters((f) => ({ ...f, page: 1 }))}
          />
        </div>
        <div className="md:col-span-2">
          <Input
            placeholder="Phone (e.g. 0712… or 2557…)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setFilters((f) => ({ ...f, page: 1 }))}
          />
        </div>
        <div className="md:col-span-2">
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Select value={filters.category ?? "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, category: v === "__all" ? undefined : v, page: 1 }))}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Select value={filters.message_type ?? "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, message_type: v === "__all" ? undefined : v, page: 1 }))}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All types</SelectItem>
              {["text", "template", "media", "button", "image", "document"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-1">
          <Button className="w-full" onClick={() => setFilters((f) => ({ ...f, page: 1 }))}>Apply</Button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b">
          <div className="col-span-3">Recipient</div>
          <div className="col-span-3">Purpose</div>
          <div className="col-span-2">Type / Template</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Updated</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-14 text-center text-sm text-slate-500">
            No WhatsApp messages match your filters yet.
          </div>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => {
              const hasImage = !!log.media_url;
              const displayName = (log.recipient_name && log.recipient_name.trim()) || log.recipient_phone;
              const initials = displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("") || "?";
              return (
                <li key={log.id} className="px-3 sm:px-4 py-3 hover:bg-slate-50/60">
                  {/* Mobile / tablet: stacked card layout */}
                  <div className="flex gap-3 lg:hidden">
                    {hasImage ? (
                      <img
                        src={log.media_url!}
                        alt=""
                        className="w-12 h-12 rounded-md object-cover bg-slate-100 shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{displayName}</div>
                          {log.recipient_name && (
                            <div className="text-[11px] text-slate-500 truncate">{log.recipient_phone}</div>
                          )}
                        </div>
                        <StatusPill status={log.status} />
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-1">
                        {CATEGORY_LABEL[log.category] ?? log.category}
                        {log.template_name ? <span className="text-slate-400"> · {log.template_name}</span> : null}
                      </div>
                      {log.summary && (
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-1 break-words">{log.summary}</div>
                      )}
                      {log.failure_reason && (
                        <div className="text-[11px] text-rose-600 truncate mt-0.5">{log.failure_reason}</div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-400">
                          {log.updated_at ? getTimeAgo(log.updated_at) : "—"}
                          {log.retry_count > 0 && <> · Retry × {log.retry_count}</>}
                        </span>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onOpenLog(log.id)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {log.retryable && (
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setResendTarget(log)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: 12-col grid */}
                  <div className="hidden lg:grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-3 min-w-0 flex items-center gap-3">
                      {hasImage ? (
                        <img
                          src={log.media_url!}
                          alt=""
                          className="w-10 h-10 rounded-md object-cover bg-slate-100 shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{displayName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{log.recipient_phone}</div>
                      </div>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <div className="text-sm text-slate-800 truncate">
                        {CATEGORY_LABEL[log.category] ?? log.category}
                      </div>
                      {log.summary && (
                        <div className="text-[11px] text-slate-500 truncate">{log.summary}</div>
                      )}
                      {log.failure_reason && (
                        <div className="text-[11px] text-rose-600 truncate">{log.failure_reason}</div>
                      )}
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-xs text-slate-700">{log.message_type}</div>
                      <div className="text-[11px] text-slate-500 truncate">{log.template_name || log.action || "—"}</div>
                    </div>
                    <div className="col-span-2">
                      <StatusPill status={log.status} />
                      {log.retry_count > 0 && (
                        <div className="text-[11px] text-slate-500 mt-1">Retry × {log.retry_count}</div>
                      )}
                    </div>
                    <div className="col-span-1 text-xs text-slate-500">
                      {log.updated_at ? getTimeAgo(log.updated_at) : "—"}
                    </div>
                    <div className="col-span-1 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onOpenLog(log.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {log.retryable && (
                        <Button size="sm" variant="outline" onClick={() => setResendTarget(log)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <div className="text-slate-500">
              Page {pagination.current_page} of {pagination.total_pages} · {pagination.total} total
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current_page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current_page >= pagination.total_pages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!activeLog} onOpenChange={(o) => !o && setActiveLog(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-auto max-w-[min(48rem,calc(100vw-1.5rem))] max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">WhatsApp message detail</DialogTitle>
          </DialogHeader>
          {activeLoading || !activeLog?.created_at ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4 text-sm min-w-0">
              {activeLog.media_url && (
                <div className="rounded-lg border bg-slate-50 p-3 flex justify-center">
                  <img
                    src={activeLog.media_url}
                    alt="Card preview"
                    className="max-h-72 w-auto max-w-full rounded-md shadow-sm object-contain"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="rounded-lg border bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Recipient</div>
                <div className="text-sm font-medium text-slate-900 break-words">
                  {activeLog.recipient_name || activeLog.recipient_phone}
                </div>
                {activeLog.recipient_name && (
                  <div className="text-xs text-slate-500 break-words">{activeLog.recipient_phone}</div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="Status" value={<StatusPill status={activeLog.status} />} />
                <Info label="Purpose" value={CATEGORY_LABEL[activeLog.category] ?? activeLog.category} />
                <Info label="Message type" value={activeLog.message_type} />
                <Info label="Template" value={activeLog.template_name ?? activeLog.action ?? "—"} />
                <Info label="Language" value={activeLog.language ?? "—"} />
                <Info label="Provider message id" value={activeLog.provider_message_id ?? "—"} />
                <Info label="Retries" value={String(activeLog.retry_count ?? 0)} />
                <Info label="Queued" value={activeLog.queued_at ? new Date(activeLog.queued_at).toLocaleString() : "—"} />
                <Info label="Sent" value={activeLog.sent_at ? new Date(activeLog.sent_at).toLocaleString() : "—"} />
                <Info label="Delivered" value={activeLog.delivered_at ? new Date(activeLog.delivered_at).toLocaleString() : "—"} />
                <Info label="Read" value={activeLog.read_at ? new Date(activeLog.read_at).toLocaleString() : "—"} />
                {activeLog.failed_at && <Info label="Failed" value={new Date(activeLog.failed_at).toLocaleString()} />}
              </div>

              {(activeLog.failure_reason || activeLog.error_code || activeLog.error_message) && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="text-xs font-semibold text-rose-800 uppercase tracking-wide mb-1">Failure details</div>
                  {activeLog.failure_reason && <div className="text-sm text-rose-900 break-words">{activeLog.failure_reason}</div>}
                  <div className="text-xs text-rose-700 mt-1 break-words">
                    {activeLog.error_code && <span className="mr-2">Code: <code>{activeLog.error_code}</code></span>}
                    {activeLog.error_message && <span className="break-all">Message: {activeLog.error_message}</span>}
                  </div>
                </div>
              )}

              {activeLog.summary && (
                <Section title="Summary">
                  <div className="whitespace-pre-wrap break-words text-slate-800">{activeLog.summary}</div>
                </Section>
              )}

              <Section title="Request payload">
                <Json value={activeLog.request_payload} />
              </Section>
              <Section title="Response payload">
                <Json value={activeLog.response_payload} />
              </Section>
              {activeLog.webhook_payload && (
                <Section title="Latest webhook update">
                  <Json value={activeLog.webhook_payload} />
                </Section>
              )}

              {activeLog.history && activeLog.history.length > 0 && (
                <Section title="Related attempts">
                  <ul className="space-y-1">
                    {activeLog.history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1">
                        <span className="truncate">{new Date(h.created_at || "").toLocaleString()}</span>
                        <StatusPill status={h.status} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {activeLog?.retryable && (
              <Button variant="outline" onClick={() => { setResendTarget(activeLog); }}>
                <RotateCcw className="h-4 w-4 mr-2" /> Resend
              </Button>
            )}
            <Button onClick={() => setActiveLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend confirm */}
      <AlertDialog open={!!resendTarget} onOpenChange={(o) => !o && setResendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend this WhatsApp message?</AlertDialogTitle>
            <AlertDialogDescription>
              A brand-new send attempt will be queued to{" "}
              <span className="font-medium">{resendTarget?.recipient_name || resendTarget?.recipient_phone}</span>
              {" "}using the same purpose and content. The original failure record stays in your logs for audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resendBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onResend} disabled={resendBusy}>
              {resendBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Yes, resend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-xs">
      <div className="uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 break-all">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{title}</div>
      <div className="rounded-lg border bg-slate-50 p-3">{children}</div>
    </div>
  );
}

function Json({ value }: { value: any }) {
  if (value === null || value === undefined) return <div className="text-slate-500 text-xs">No data</div>;
  let text = "";
  try { text = JSON.stringify(value, null, 2); } catch { text = String(value); }
  return (
    <pre className="text-[11px] leading-snug text-slate-800 max-h-72 overflow-y-auto whitespace-pre-wrap break-all">{text}</pre>
  );
}
