/**
 * AdminPaymentsSettlements — pending payouts queue. Admins:
 *   • Open a request → see beneficiary payment profile
 *   • Send money externally
 *   • Mark Paid (capture proof + reference + channel)
 *
 * Also supports Hold, Reject, Escalate, Add note.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Search, Filter, Banknote, Pause, X, Flag, MessageSquarePlus, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { adminPaymentsOpsApi, type SettlementRow } from "@/lib/api/adminPaymentsOps";
import { showApiErrors } from "@/lib/api/showApiErrors";
import {
  fmtDateTime, fmtMoney, StatusBadge, priorityTone,
} from "./_shared";

const STATUSES = ["all", "pending", "approved", "under_review", "settled", "rejected", "hold", "escalated"];

export default function AdminPaymentsSettlements() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pending");
  const [openRow, setOpenRow] = useState<SettlementRow | null>(null);
  const [markPaying, setMarkPaying] = useState<SettlementRow | null>(null);
  const [actionDialog, setActionDialog] = useState<{ row: SettlementRow; kind: "hold" | "reject" | "escalate" | "note" } | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-settlements", page, q, status],
    queryFn: async () => {
      const res = await adminPaymentsOpsApi.settlements({
        page, limit: 25,
        q: q.trim() || undefined,
        status: status === "all" ? undefined : status,
      });
      return res.success ? res.data : null;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-settlements"] });
    qc.invalidateQueries({ queryKey: ["admin-payments-summary"] });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search request code, beneficiary, reference…"
              className="pl-9 h-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40 h-9 text-xs"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : !data?.settlements?.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No settlement requests in this view.</CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Beneficiary</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Method</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Age</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Priority</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Requested</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {data.settlements.map((s: SettlementRow) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">{s.beneficiary?.name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{s.request_code}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div>{s.payout_provider_name ?? s.payout_method ?? "—"}</div>
                      <div className="text-[10px]">{s.payout_account_number ?? ""}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmtMoney(s.amount, s.currency_code)}</td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">{s.age_days != null ? `${s.age_days}d` : "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase", priorityTone(s.priority))}>
                        {s.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpenRow(s)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data?.pagination && (
        <div className="flex items-center justify-end text-xs text-muted-foreground pt-1 gap-1.5">
          <span className="mr-2">Page {page} {isFetching && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</span>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8">Prev</Button>
          <Button size="sm" variant="outline" disabled={!(data.pagination as any)?.has_more} onClick={() => setPage((p) => p + 1)} className="h-8">Next</Button>
        </div>
      )}

      {/* Drawer with detail + actions */}
      <SettlementDrawer
        row={openRow}
        onClose={() => setOpenRow(null)}
        onMarkPaid={(r) => { setOpenRow(null); setMarkPaying(r); }}
        onAction={(r, kind) => { setOpenRow(null); setActionDialog({ row: r, kind }); }}
      />

      {/* Mark Paid */}
      {markPaying && (
        <MarkPaidDialog
          row={markPaying}
          onClose={() => setMarkPaying(null)}
          onDone={() => { setMarkPaying(null); refresh(); }}
        />
      )}

      {/* Hold / Reject / Escalate / Note */}
      {actionDialog && (
        <ActionDialog
          row={actionDialog.row}
          kind={actionDialog.kind}
          onClose={() => setActionDialog(null)}
          onDone={() => { setActionDialog(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────────────

function SettlementDrawer({
  row, onClose, onMarkPaid, onAction,
}: {
  row: SettlementRow | null;
  onClose: () => void;
  onMarkPaid: (r: SettlementRow) => void;
  onAction: (r: SettlementRow, kind: "hold" | "reject" | "escalate" | "note") => void;
}) {
  const beneficiaryQuery = useQuery({
    queryKey: ["admin-settlement-beneficiary", row?.beneficiary?.id],
    queryFn: async () => {
      if (!row?.beneficiary?.id) return null;
      const res = await adminPaymentsOpsApi.beneficiary(row.beneficiary.id);
      return res.success ? res.data : null;
    },
    enabled: !!row?.beneficiary?.id,
  });

  if (!row) return null;
  const isOpen = !!row;
  const isTerminal = ["settled", "rejected", "cancelled"].includes(row.status);

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settlement request</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-4 text-sm">
          <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount owed</p>
                <p className="text-2xl font-bold text-foreground">{fmtMoney(row.amount, row.currency_code)}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Field label="Code">{row.request_code}</Field>
              <Field label="Requested">{fmtDateTime(row.created_at)}</Field>
              <Field label="Age">{row.age_days != null ? `${row.age_days}d` : "—"}</Field>
              <Field label="Priority"><span className="capitalize">{row.priority}</span></Field>
            </div>
          </div>

          <Section title="Beneficiary">
            <Row label="Name">{row.beneficiary?.name ?? "—"}</Row>
            <Row label="Phone">{row.beneficiary?.phone ?? "—"}</Row>
            <Row label="Email">{row.beneficiary?.email ?? "—"}</Row>
          </Section>

          <Section title="Payout profile">
            <Row label="Method">{row.payout_method ?? "—"}</Row>
            <Row label="Provider">{row.payout_provider_name ?? "—"}</Row>
            <Row label="Account name">{row.payout_account_holder ?? "—"}</Row>
            <Row label="Account / phone"><span className="font-mono">{row.payout_account_number ?? "—"}</span></Row>
          </Section>

          {beneficiaryQuery.data && (
            <Section title="Beneficiary history">
              <Row label="Verified">{beneficiaryQuery.data.is_verified ? "Yes" : "No"}</Row>
              <Row label="Lifetime payouts">{beneficiaryQuery.data.payout_count ?? 0}</Row>
              <Row label="Failed payouts">{beneficiaryQuery.data.failed_count ?? 0}</Row>
            </Section>
          )}

          {row.user_note && (
            <Section title="User note">
              <p className="text-xs text-muted-foreground italic">"{row.user_note}"</p>
            </Section>
          )}
          {row.admin_note && (
            <Section title="Admin note">
              <p className="text-xs text-muted-foreground italic">"{row.admin_note}"</p>
            </Section>
          )}

          {!isTerminal && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => onMarkPaid(row)} className="gap-1.5">
                <Banknote className="w-3.5 h-3.5" /> Mark paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(row, "hold")} className="gap-1.5">
                <Pause className="w-3.5 h-3.5" /> Hold
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(row, "escalate")} className="gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Escalate
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(row, "reject")} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                <X className="w-3.5 h-3.5" /> Reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onAction(row, "note")} className="gap-1.5 ml-auto">
                <MessageSquarePlus className="w-3.5 h-3.5" /> Add note
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Mark Paid ──────────────────────────────────────────────────────────────

function MarkPaidDialog({ row, onClose, onDone }: {
  row: SettlementRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reference, setReference] = useState("");
  const [channel, setChannel] = useState(row.payout_provider_name ?? row.payout_method ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reference.trim()) { toast.error("External reference is required"); return; }
    if (!channel.trim()) { toast.error("Channel used is required"); return; }
    setBusy(true);
    const res = await adminPaymentsOpsApi.settlementAction(row.id, "mark-paid", {
      external_reference: reference.trim(),
      channel: channel.trim(),
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (res.success) { toast.success("Settlement marked as paid"); onDone(); }
    else showApiErrors(res, "Mark-paid failed");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-600" /> Mark as paid
          </DialogTitle>
          <DialogDescription>
            Confirms that <strong>{fmtMoney(row.amount, row.currency_code)}</strong> was sent to{" "}
            <strong>{row.beneficiary?.name}</strong> via {row.payout_provider_name ?? row.payout_method}.
            This action is audit-logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">External reference *</Label>
            <Input
              value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. MPESA confirmation code"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Channel used *</Label>
            <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="e.g. M-Pesa B2C, NMB transfer" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Internal note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note for finance trail" />
          </div>
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-50/40 dark:bg-emerald-900/10 p-2.5 text-[11px] text-muted-foreground">
            Wallet balance will be debited and the user notified once you confirm.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generic action (hold / reject / escalate / note) ───────────────────────

const ACTION_COPY: Record<string, { title: string; desc: string; cta: string; needsNote: boolean }> = {
  hold:     { title: "Place on hold", desc: "Pauses the request until released.", cta: "Hold", needsNote: true },
  reject:   { title: "Reject request", desc: "User will be notified. Funds remain in their wallet.", cta: "Reject", needsNote: true },
  escalate: { title: "Escalate", desc: "Flag for finance lead review.", cta: "Escalate", needsNote: true },
  note:     { title: "Add internal note", desc: "Visible to finance admins only.", cta: "Save note", needsNote: true },
};

function ActionDialog({
  row, kind, onClose, onDone,
}: {
  row: SettlementRow;
  kind: "hold" | "reject" | "escalate" | "note";
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = ACTION_COPY[kind];

  const submit = async () => {
    if (copy.needsNote && !note.trim()) { toast.error("A note is required"); return; }
    setBusy(true);
    const res = await adminPaymentsOpsApi.settlementAction(row.id, kind, { note: note.trim() });
    setBusy(false);
    if (res.success) { toast.success(`${copy.cta} done`); onDone(); }
    else showApiErrors(res, `${copy.cta} failed`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-xs font-medium">Note {copy.needsNote && "*"}</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Reason / context" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : copy.cta}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-xs font-medium mt-0.5">{children}</p>
  </div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">{title}</p>
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">{children}</div>
  </div>
);
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground text-right">{children}</span>
  </div>
);
