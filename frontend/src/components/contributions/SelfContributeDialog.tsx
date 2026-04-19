/**
 * SelfContributeDialog — collects amount + optional payment reference + note,
 * submits to POST /user-contributors/events/{id}/self-contribute. The
 * contribution lands in the organiser's pending queue for approval.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { contributorsApi } from "@/lib/api/contributors";
import { showApiErrors } from "@/lib/api/showApiErrors";
import { formatPrice } from "@/utils/formatPrice";
import { toast } from "sonner";
import { HandCoins, Info } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventName: string;
  currency: string;
  balance: number;
  onSubmitted?: () => void;
}

export function SelfContributeDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
  currency,
  balance,
  onSubmitted,
}: Props) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setAmount("");
    setReference("");
    setNote("");
  };

  const handleSubmit = async () => {
    const num = parseFloat(amount.replace(/[^\d.]/g, ""));
    if (!num || num <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    setBusy(true);
    try {
      const res = await contributorsApi.selfContribute(eventId, {
        amount: num,
        payment_reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      if (res.success) {
        toast.success("Contribution submitted — waiting for the organiser to approve.");
        reset();
        onSubmitted?.();
        onOpenChange(false);
      } else {
        showApiErrors(res, "Failed to submit contribution");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit contribution");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <HandCoins className="w-5 h-5 text-primary" />
            </div>
            Pay contribution
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            For <span className="font-medium text-foreground">{eventName}</span>
            {balance > 0 && (
              <> · Outstanding balance{" "}
                <span className="font-medium text-foreground">{currency} {formatPrice(balance)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-sm font-medium">Amount ({currency})</Label>
            <FormattedNumberInput
              id="amount"
              value={amount}
              onChange={setAmount}
              placeholder="50,000"
              className="text-lg font-semibold h-12"
              autoFocus
            />
            {balance > 0 && (
              <div className="flex gap-2 pt-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAmount(String(Math.round(balance / 2)))}
                >
                  ½ ({currency} {formatPrice(Math.round(balance / 2))})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAmount(String(balance))}
                >
                  Full balance ({currency} {formatPrice(balance)})
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reference" className="text-sm font-medium">
              Payment reference <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. M-Pesa code QFT3K2L8"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-sm font-medium">
              Note to organiser <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Paid via family pool"
            />
          </div>

          <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              Your contribution will be marked as <strong>pending</strong>. The organiser will
              confirm it after they receive the money. You'll get a notification once approved.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !amount.trim()}>
            {busy ? "Submitting…" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SelfContributeDialog;
