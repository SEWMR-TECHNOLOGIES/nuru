/**
 * PayDepositDialog — collects payment method + phone, calls bookingsApi.payDeposit.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookingsApi } from "@/lib/api/bookings";
import { showApiErrors } from "@/lib/api/showApiErrors";
import { formatPrice } from "@/utils/formatPrice";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  amount: number;
  onSuccess?: () => void;
}

export function PayDepositDialog({ open, onOpenChange, bookingId, amount, onSuccess }: Props) {
  const [method, setMethod] = useState("mpesa");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePay = async () => {
    if (method === "mpesa" && !phone.trim()) {
      toast.error("Enter your M-Pesa phone number");
      return;
    }
    setBusy(true);
    try {
      const res = await bookingsApi.payDeposit(bookingId, {
        payment_method: method,
        phone: phone.trim() || undefined,
      });
      if (res.success) {
        toast.success("Payment initiated — check your phone for the prompt");
        onSuccess?.();
        onOpenChange(false);
      } else {
        showApiErrors(res, "Payment failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Pay deposit
          </DialogTitle>
          <DialogDescription>
            Pay {formatPrice(amount)} to secure your booking. Funds are held in escrow and only released once the service is delivered.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="airtel">Airtel Money</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(method === "mpesa" || method === "airtel") && (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 0712 345 678"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={busy}>
            {busy ? "Processing…" : `Pay ${formatPrice(amount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PayDepositDialog;
