/**
 * AdminPaymentsCommissions — manage the active commission amount per country.
 *
 * Backend contract note:
 * - GET /admin/payments/commissions returns simple records with
 *   `commission_amount`, `notes`, `is_active`, `created_at`, `updated_at`
 * - there is no target_type / flat_fee / percent_fee model on this backend.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { adminPaymentsApi } from "@/lib/api/adminPayments";
import { showApiErrors } from "@/lib/api/showApiErrors";
import type { CommissionSetting, CountryCode } from "@/lib/api/payments-types";

const COUNTRIES: CountryCode[] = ["TZ", "KE"];
const COUNTRY_CURRENCY: Record<CountryCode, "TZS" | "KES"> = {
  TZ: "TZS",
  KE: "KES",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatAmount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "0";
}

export default function AdminPaymentsCommissions() {
  const qc = useQueryClient();
  const [country, setCountry] = useState<CountryCode>("TZ");
  const [editing, setEditing] = useState<CommissionSetting | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-commissions", country],
    queryFn: async () => {
      const res = await adminPaymentsApi.listCommissions({ country_code: country });
      const rows = res.success && Array.isArray(res.data) ? res.data : [];
      return rows.filter((row) => row.country_code === country);
    },
  });

  const active = useMemo(() => data?.find((c) => c.is_active) ?? null, [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-commissions", country] });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={country} onValueChange={(v) => setCountry(v as CountryCode)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreating(true)} className="gap-2 ml-auto">
          <Plus className="w-4 h-4" /> Set commission
        </Button>
      </div>

      {active && (
        <Card>
          <CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active commission</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xl font-semibold text-foreground">
                  {formatAmount(active.commission_amount)} {active.currency_code}
                </p>
                <Badge variant="default">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Updated {formatDate(active.updated_at ?? active.created_at)}
              </p>
            </div>
            <Button variant="outline" onClick={() => setEditing(active)} className="gap-2">
              <Pencil className="w-4 h-4" /> Edit active
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data?.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No commission configured for {country}. Add one to start charging fees.
        </CardContent></Card>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Country</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-left px-4 py-2.5">Notes</th>
                <th className="text-center px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{c.country_code}</div>
                    <div className="text-[11px] text-muted-foreground">{c.currency_code ?? COUNTRY_CURRENCY[country]}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatAmount(c.commission_amount)} {c.currency_code}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[280px]">
                    <span className="line-clamp-2">{c.notes || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(c.updated_at ?? c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <CommissionFormDialog
          open
          country={country}
          commission={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { refresh(); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function CommissionFormDialog({
  open, country, commission, onClose, onSaved,
}: {
  open: boolean;
  country: CountryCode;
  commission: CommissionSetting | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!commission;
  const [form, setForm] = useState({
    country_code: commission?.country_code ?? country,
    currency_code: commission?.currency_code ?? COUNTRY_CURRENCY[country],
    commission_amount: commission?.commission_amount ?? 0,
    notes: commission?.notes ?? "",
    is_active: commission?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setForm((f) => ({
        ...f,
        country_code: country,
        currency_code: COUNTRY_CURRENCY[country],
      }));
    }
  }, [country, isEdit]);

  const save = async () => {
    if (!Number.isFinite(form.commission_amount) || form.commission_amount < 0) {
      toast.error("Commission amount must be 0 or higher");
      return;
    }

    setBusy(true);
    const payload = {
      country_code: form.country_code,
      currency_code: form.currency_code,
      commission_amount: form.commission_amount,
      notes: form.notes.trim() || undefined,
      is_active: form.is_active,
    };
    const res = isEdit
      ? await adminPaymentsApi.updateCommission(commission!.id, payload)
      : await adminPaymentsApi.createCommission(payload);
    setBusy(false);
    if (res.success) {
      toast.success(isEdit ? "Commission updated" : "Commission created");
      onSaved();
    } else {
      showApiErrors(res, "Save failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit commission" : "Set commission"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Country">
            <Input value={form.country_code} disabled />
          </Field>
          <Field label="Currency">
            <Input value={form.currency_code} disabled />
          </Field>
          <Field label="Commission amount">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.commission_amount}
              onChange={(e) => setForm({ ...form, commission_amount: Number(e.target.value || 0) })}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal note for finance team"
              rows={4}
            />
          </Field>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 cursor-pointer">
            <span className="text-xs font-medium">Active</span>
            <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving..." : isEdit ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">{label}</Label>
    {children}
  </div>
);
