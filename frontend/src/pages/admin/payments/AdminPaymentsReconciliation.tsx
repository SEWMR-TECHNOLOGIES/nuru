/**
 * AdminPaymentsReconciliation — heuristics that surface anomalies between
 * provider records, internal transactions, and settled payouts.
 *
 * The backend `/admin/payments/reconciliation` endpoint returns categorised
 * issue lists. This page renders each as a card with a count and a table
 * of offending rows.
 */
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Copy, BadgeAlert, RefreshCcw, FileWarning, GitBranch, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminPaymentsOpsApi } from "@/lib/api/adminPaymentsOps";
import { fmtDateTime, fmtMoney } from "./_shared";

interface ReconciliationData {
  duplicate_payments?: any[];
  uncredited_payments?: any[];
  overpayments?: any[];
  missing_references?: any[];
  failed_callbacks?: any[];
}

const SECTIONS: Array<{
  key: keyof ReconciliationData;
  title: string;
  desc: string;
  icon: any;
  tone: string;
}> = [
  { key: "duplicate_payments",  title: "Duplicate payments",   desc: "Same payer, same amount, same target within a short window.", icon: Copy,        tone: "amber" },
  { key: "uncredited_payments", title: "Uncredited payments",  desc: "Succeeded incoming payments without a matching wallet entry.", icon: BadgeAlert,  tone: "red"   },
  { key: "overpayments",        title: "Overpayments",         desc: "Net amount paid exceeds expected target balance.",            icon: AlertTriangle, tone: "orange" },
  { key: "missing_references",  title: "Missing references",   desc: "Settled payouts without an external provider reference.",     icon: FileWarning, tone: "amber" },
  { key: "failed_callbacks",    title: "Failed callbacks",     desc: "Provider callbacks the system never reconciled to a transaction.", icon: GitBranch, tone: "red" },
];

const TONE_BG: Record<string, string> = {
  amber:  "from-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  red:    "from-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  orange: "from-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};

export default function AdminPaymentsReconciliation() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-payments-reconciliation"],
    queryFn: async () => {
      const res = await adminPaymentsOpsApi.reconciliation();
      return (res.success ? res.data : {}) as ReconciliationData;
    },
  });

  const totalIssues = data
    ? SECTIONS.reduce((acc, s) => acc + (data[s.key]?.length ?? 0), 0)
    : 0;

  if (isLoading) {
    return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{totalIssues === 0 ? "All clear" : `${totalIssues} item${totalIssues === 1 ? "" : "s"} need attention`}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Heuristic checks across the last 30 days.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Re-run
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {SECTIONS.map((s) => {
          const rows = (data?.[s.key] ?? []) as any[];
          const Icon = s.icon;
          return (
            <Card key={s.key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br to-transparent border flex items-center justify-center ${TONE_BG[s.tone]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{s.title}</h3>
                      <span className="text-xs font-bold text-foreground">{rows.length}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                </div>

                {rows.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {rows.slice(0, 8).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-border/60 last:border-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs truncate">{r.transaction_code ?? r.request_code ?? r.reference ?? r.id ?? "—"}</div>
                            <div className="text-muted-foreground">{r.beneficiary_name ?? r.payer_name ?? ""}</div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            {r.amount != null && <div className="font-medium">{fmtMoney(r.amount, r.currency_code ?? "TZS")}</div>}
                            <div className="text-muted-foreground">{fmtDateTime(r.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {rows.length > 8 && (
                      <p className="text-[11px] text-muted-foreground text-center mt-2">+ {rows.length - 8} more</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
