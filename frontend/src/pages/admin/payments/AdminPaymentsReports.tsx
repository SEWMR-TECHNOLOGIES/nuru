/**
 * AdminPaymentsReports — generate and preview the 10 finance reports.
 *
 * Approach (matches Contributions / Expenses):
 *   1. Fetch raw rows from the backend report endpoint.
 *   2. Render via generatePaymentsReportHtml() into a ReportPreviewDialog.
 *   3. User can Print → Save as PDF, or click CSV to download the raw file.
 *
 * Backend endpoint shape (admin_payments_ops):
 *   GET /admin/payments/reports?type=<key>&format=json|csv|pdf&date_from&date_to
 *      JSON: { rows: [...], summary: [...], columns: [...], title: "..." }
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileBarChart, Calendar as CalendarIcon, Download, Eye, Loader2, FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { adminPaymentsOpsApi, type ReportType } from "@/lib/api/adminPaymentsOps";
import {
  generatePaymentsReportHtml,
  type PaymentsReportColumn,
  type PaymentsReportSummaryCard,
} from "@/utils/generatePdf";
import ReportPreviewDialog from "@/components/ReportPreviewDialog";

const FALLBACK_TYPES: ReportType[] = [
  { key: "daily_collections",         label: "Daily collections" },
  { key: "weekly_collections",        label: "Weekly collections" },
  { key: "monthly_collections",       label: "Monthly collections" },
  { key: "country_breakdown",         label: "Country breakdown" },
  { key: "commission_revenue",        label: "Commission revenue" },
  { key: "pending_payout_liabilities",label: "Pending payout liabilities" },
  { key: "completed_settlements",     label: "Completed settlements" },
  { key: "failed_payments",           label: "Failed payments" },
  { key: "vendor_earnings",           label: "Vendor earnings" },
  { key: "organiser_earnings",        label: "Event organiser earnings" },
];

interface ReportJsonResponse {
  title: string;
  rows: Record<string, unknown>[];
  columns: PaymentsReportColumn[];
  summary: PaymentsReportSummaryCard[];
  footer_note?: string;
}

export default function AdminPaymentsReports() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [previewType, setPreviewType] = useState<ReportType | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const { data: typesData } = useQuery({
    queryKey: ["admin-payments-report-types"],
    queryFn: async () => {
      const res = await adminPaymentsOpsApi.reportTypes();
      return res.success && res.data?.types?.length ? res.data.types : FALLBACK_TYPES;
    },
    staleTime: 5 * 60 * 1000,
  });

  const types = typesData ?? FALLBACK_TYPES;

  const fetchJson = async (type: string): Promise<ReportJsonResponse | null> => {
    const url = adminPaymentsOpsApi.reportUrl(type, "csv", from || undefined, to || undefined)
      .replace(/format=csv/, "format=json");
    const token = localStorage.getItem("admin_token");
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.data ?? json;
  };

  const handlePreview = async (type: ReportType) => {
    setLoadingKey(`preview:${type.key}`);
    try {
      const json = await fetchJson(type.key);
      if (!json) {
        toast.error("Could not load report data");
        return;
      }
      const dateLabel = from || to ? `${from || "…"} → ${to || "…"}` : undefined;
      const html = generatePaymentsReportHtml(
        json.title || type.label,
        json.rows || [],
        json.columns || [],
        json.summary || [],
        dateLabel,
        json.footer_note,
      );
      setPreviewHtml(html);
      setPreviewType(type);
    } catch (e) {
      toast.error("Preview failed");
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDownloadCsv = async (type: ReportType) => {
    setLoadingKey(`csv:${type.key}`);
    try {
      const url = adminPaymentsOpsApi.reportUrl(type.key, "csv", from || undefined, to || undefined);
      const token = localStorage.getItem("admin_token");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) { toast.error("Download failed"); return; }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${type.key}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("CSV downloaded");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> Date from
              </Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> Date to
              </Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost" size="sm"
                onClick={() => { setFrom(""); setTo(""); }}
                disabled={!from && !to}
              >
                Clear
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Empty dates return all-time data. Reports use the date the underlying payment was created.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {types.map((t) => {
          const previewing = loadingKey === `preview:${t.key}`;
          const downloading = loadingKey === `csv:${t.key}`;
          return (
            <Card key={t.key} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileBarChart className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{t.label}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{t.key}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => handlePreview(t)} disabled={previewing || downloading}
                  >
                    {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    Preview / PDF
                  </Button>
                  <Button
                    size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => handleDownloadCsv(t)} disabled={previewing || downloading}
                  >
                    {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReportPreviewDialog
        open={!!previewType}
        onOpenChange={(o) => !o && setPreviewType(null)}
        title={previewType?.label ?? "Report"}
        html={previewHtml}
        onDownloadExcel={previewType ? () => handleDownloadCsv(previewType) : undefined}
      />
    </div>
  );
}
