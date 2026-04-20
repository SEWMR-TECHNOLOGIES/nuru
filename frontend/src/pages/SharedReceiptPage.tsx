/**
 * SharedReceiptPage — public, no-auth view of a successful Nuru receipt.
 *
 *  Route: /shared/receipt/:transaction_code
 *
 * Anyone with the link can verify the payment was real. We re-use the same
 * branded HTML used for PDF/print so the visible page and the printed page
 * stay byte-identical with the authenticated `/wallet/receipt/:code` view.
 *
 * Only `paid`/`credited` transactions are returned by the backend, so there
 * is nothing sensitive to redact here beyond what the public endpoint already
 * strips (failure_reason, gateway payloads).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { generateReceiptHtml } from "@/utils/generatePdf";
import { getActiveHost } from "@/lib/region/host";
import nuruLogo from "@/assets/nuru-logo.png";
import type { Transaction } from "@/lib/api/payments-types";

const SharedReceiptPage = () => {
  const { transaction_code } = useParams<{ transaction_code: string }>();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!transaction_code) throw new Error("Missing receipt code");
        const res = await api.payments.getPublic(transaction_code);
        if (cancelled) return;
        if (!res.success || !res.data) throw new Error(res.message || "Receipt not found");
        setTx(res.data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Receipt not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transaction_code]);

  const html = useMemo(() => (tx ? generateReceiptHtml(tx) : ""), [tx]);
  const host = getActiveHost();

  const handlePrint = () => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <h1 className="font-semibold text-foreground">Receipt unavailable</h1>
            <p className="text-sm text-muted-foreground mt-1">
              This link may have expired or the payment is not yet confirmed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 py-6 md:py-10">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <a href={`https://${host}`} className="flex items-center gap-2">
            <img src={nuruLogo} alt="Nuru" className="h-7 w-auto" />
            <span className="text-xs text-muted-foreground hidden sm:inline">{host}</span>
          </a>
          <Button onClick={handlePrint} size="sm" className="gap-2">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background border border-border rounded-full px-2.5 py-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Verified by Nuru
        </div>

        <Card className="overflow-hidden">
          {/* Same branded HTML used for PDF — identical look on screen & print */}
          <iframe
            title="receipt"
            className="w-full"
            style={{ height: "1100px", border: 0, background: "white" }}
            srcDoc={html}
          />
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          Verify at {host}/shared/receipt/{tx.transaction_code}
        </p>
      </div>
    </div>
  );
};

export default SharedReceiptPage;
