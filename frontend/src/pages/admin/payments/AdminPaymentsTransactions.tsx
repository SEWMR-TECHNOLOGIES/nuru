/**
 * AdminPaymentsTransactions — searchable, filterable transaction explorer with
 * a manual-settlement override (audit-logged server side). This is the
 * admin's primary tool to debug stuck payments.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, ChevronLeft, ChevronRight, ShieldAlert, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminPaymentsApi, type AdminTxQueryParams } from "@/lib/api/adminPayments";
import { showApiErrors } from "@/lib/api/showApiErrors";
import type { Transaction, TransactionStatus, CountryCode } from "@/lib/api/payments-types";

const STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const TERMINAL_OPTIONS: TransactionStatus[] = ["succeeded", "failed", "cancelled", "refunded"];
// Statuses that may still benefit from a manual gateway re-poll. We allow
// admins to re-check `failed` txns too because gateways occasionally flip
// late callbacks (FAILED → PAID after a customer retries the PIN).
const REFRESHABLE: TransactionStatus[] = ["pending", "processing", "failed"];

const statusTone = (s: TransactionStatus) => {
  switch (s) {
    case "succeeded": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "processing":
    case "pending": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "failed":
    case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "refunded": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function AdminPaymentsTransactions() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [q, setQ] = useState("");
  const [settling, setSettling] = useState<Transaction | null>(null);

  const params: AdminTxQueryParams = {
    page, limit: 25,
    status: status === "all" ? undefined : status,
    country_code: country === "all" ? undefined : country as CountryCode,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-transactions", params],
    queryFn: async () => {
      const res = await adminPaymentsApi.listTransactions(params);
      return res.success ? res.data : null;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-transactions"] });

  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const refreshOne = async (tx: Transaction) => {
    setRefreshingId(tx.id);
    try {
      // Calling the user status endpoint forces the gateway poll on backend.
      const res = await api.payments.getStatus(tx.id);
      if (res.success) {
        const updated = res.data;
        if (updated && ["failed", "cancelled"].includes(updated.status)) {
          toast.error(`Status: ${updated.status}`, {
            description: updated.failure_reason || "Gateway returned no reason.",
          });
        } else {
          toast.success(`Status: ${updated?.status ?? "unchanged"}`);
        }
        refresh();
      } else {
        showApiErrors(res, "Could not refresh status");
      }
    } finally {
      setRefreshingId(null);
    }
  };

  const fmtDate = (t: Transaction) => {
    const raw = t.created_at ?? t.initiated_at ?? t.completed_at ?? t.confirmed_at;
    if (!raw) return "—";
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by code, user, reference..."
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={(v) => { setCountry(v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="TZ">TZ</SelectItem>
              <SelectItem value="KE">KE</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Reload
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data?.transactions?.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No transactions match the current filters.
        </CardContent></Card>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Code</th>
                <th className="text-left px-4 py-2.5">Target</th>
                <th className="text-left px-4 py-2.5">Provider</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-center px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/20 align-top">
                  <td className="px-4 py-3 font-mono text-xs">{t.transaction_code}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{(t.target_type ?? "—").replace(/_/g, " ")}</div>
                    {(t.payment_description ?? t.description) && (
                      <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[260px]">
                        {t.payment_description ?? t.description}
                      </div>
                    )}
                    {t.failure_reason && ["failed", "cancelled"].includes(t.status) && (
                      <div className="text-[11px] text-destructive line-clamp-2 max-w-[260px] mt-0.5">
                        ⚠ {t.failure_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.provider_name ?? t.provider?.name ?? t.provider?.display_name ?? t.method_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {t.currency_code} {Number(t.gross_amount ?? 0).toLocaleString()}
                    {typeof t.commission_amount === "number" && t.commission_amount > 0 && (
                      <div className="text-[10px] text-muted-foreground font-normal">
                        Fee {t.commission_amount.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${statusTone(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {fmtDate(t)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {REFRESHABLE.includes(t.status as TransactionStatus) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={refreshingId === t.id}
                          onClick={() => refreshOne(t)}
                          title="Re-poll the gateway for this transaction"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === t.id ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                      )}
                      {!TERMINAL_OPTIONS.includes(t.status as TransactionStatus) ? (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSettling(t)}>
                          <ShieldAlert className="w-3.5 h-3.5" /> Settle
                        </Button>
                      ) : t.status === "failed" || t.status === "cancelled" ? (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSettling(t)} title="Override status (audit-logged)">
                          <ShieldAlert className="w-3.5 h-3.5" /> Override
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <div>
            Page {page} {isFetching && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" disabled={!(data.pagination as any)?.has_more} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {settling && (
        <SettleDialog
          tx={settling}
          onClose={() => setSettling(null)}
          onDone={() => { setSettling(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SettleDialog({ tx, onClose, onDone }: {
  tx: Transaction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<TransactionStatus>("succeeded");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!note.trim()) {
      toast.error("Please document the reason for this manual settlement");
      return;
    }
    setBusy(true);
    const res = await adminPaymentsApi.manualSettle(tx.id, { status, note: note.trim() });
    setBusy(false);
    if (res.success) { toast.success("Transaction updated"); onDone(); }
    else showApiErrors(res, "Settlement failed");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Manual settlement
          </DialogTitle>
          <DialogDescription>
            Override the status of <span className="font-mono">{tx.transaction_code}</span>.
            This is audit-logged. Use only when the gateway is stuck.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TransactionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERMINAL_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reason / note (required)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Confirmed inbound MPesa C2B txn ABC123 with finance"
            />
          </div>
          <div className="rounded-lg border border-amber-300/40 bg-amber-50/40 dark:bg-amber-900/10 p-3 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">Heads up</p>
            <p className="text-muted-foreground mt-1">
              Marking <Badge variant="outline" className="mx-0.5 text-[10px]">succeeded</Badge>
              will credit the user's wallet and trigger downstream effects.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Updating..." : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
