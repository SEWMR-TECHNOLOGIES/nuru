/**
 * CancelBookingDialog
 * -------------------
 * Two-step UX: (1) "see your refund" preview, (2) confirm cancel.
 * Used by both the bookings list and the booking detail page.
 */

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cancellationApi,
  CancellingParty,
  RefundBreakdown,
} from "@/lib/api/cancellations";
import { useCurrency } from "@/hooks/useCurrency";
import { ShieldAlert, Clock, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string | null;
  cancellingParty?: CancellingParty;
  onConfirm: (reason: string) => Promise<void>;
}

const TIER_BADGE: Record<string, string> = {
  flexible: "bg-emerald-500/10 text-emerald-700",
  moderate: "bg-amber-500/10 text-amber-700",
  strict: "bg-rose-500/10 text-rose-700",
};

export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingId,
  cancellingParty = "organiser",
  onConfirm,
}: Props) {
  const { format: formatPrice } = useCurrency();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<RefundBreakdown | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bookingId) return;
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    cancellationApi
      .preview(bookingId, cancellingParty)
      .then((res) => {
        if (res.success) setPreview(res.data);
        else setPreviewError(res.message || "Failed to load refund preview");
      })
      .catch((e) => setPreviewError(e?.message || "Failed to load preview"))
      .finally(() => setPreviewLoading(false));
  }, [open, bookingId, cancellingParty]);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  const refundIsZero = preview && preview.refund_to_organiser <= 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Cancel this booking?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review your refund first. The amount below is calculated automatically
            from the Nuru cancellation policy and cannot be changed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {previewLoading && (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {previewError && (
          <div className="text-sm text-destructive flex items-center gap-2 py-2">
            <AlertTriangle className="w-4 h-4" /> {previewError}
          </div>
        )}

        {preview && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cancellation tier</span>
              <Badge className={TIER_BADGE[preview.tier] ?? ""}>
                {preview.tier.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Time until event
              </span>
              <span>
                {preview.hours_until_event >= 24
                  ? `${Math.floor(preview.hours_until_event / 24)} days`
                  : `${preview.hours_until_event} hours`}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total paid / agreed</span>
              <span className="font-medium">{formatPrice(preview.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">You will be refunded</span>
              <span
                className={
                  "font-bold text-lg " +
                  (refundIsZero ? "text-destructive" : "text-emerald-600")
                }
              >
                {formatPrice(preview.refund_to_organiser)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Vendor retention</span>
              <span>{formatPrice(preview.vendor_retention)}</span>
            </div>

            <p className="text-xs text-muted-foreground pt-1 border-t">
              {preview.human_summary}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Reason for cancelling <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you're cancelling…"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting || !reason.trim() || previewLoading}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {submitting ? "Cancelling…" : "Confirm cancellation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CancelBookingDialog;
