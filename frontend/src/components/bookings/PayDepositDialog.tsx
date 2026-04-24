/**
 * PayDepositDialog — thin wrapper around CheckoutModal so existing call sites
 * keep working while payment goes through the new payments pipeline
 * (target_type=service_booking).
 *
 * Resolves the vendor (booking.provider.id) and forwards it as the
 * `beneficiaryUserId` so the backend credits the right wallet on success.
 * The backend also auto-resolves this from `target_id` as a safety net.
 */
import { useQuery } from "@tanstack/react-query";
import CheckoutModal from "@/components/payments/CheckoutModal";
import { bookingsApi } from "@/lib/api/bookings";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  amount: number;
  onSuccess?: () => void;
}

export function PayDepositDialog({ open, onOpenChange, bookingId, amount, onSuccess }: Props) {
  // Fetch the booking only when the dialog is opened so we can pass the
  // vendor's user_id as the beneficiary. Cached by react-query so re-opens
  // are instant.
  const { data: booking } = useQuery({
    queryKey: ["booking-detail-for-payment", bookingId],
    queryFn: async () => {
      const res = await bookingsApi.getById(bookingId);
      return res.success ? res.data : null;
    },
    enabled: !!bookingId && open,
    staleTime: 60_000,
  });

  return (
    <CheckoutModal
      open={open}
      onOpenChange={onOpenChange}
      targetType="service_booking"
      targetId={bookingId}
      beneficiaryUserId={booking?.provider?.id}
      amount={amount}
      title="Pay deposit"
      description="Funds are held in escrow and only released once the service is delivered."
      onSuccess={async () => {
        // Best-effort sync with bookings service so the booking row reflects the deposit.
        try { await bookingsApi.payDeposit(bookingId, { payment_method: "wallet" }); } catch { /* ignore */ }
        onSuccess?.();
      }}
    />
  );
}

export default PayDepositDialog;
