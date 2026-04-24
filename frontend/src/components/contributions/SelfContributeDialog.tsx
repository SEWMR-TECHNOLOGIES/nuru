/**
 * SelfContributeDialog — wrapper around CheckoutModal. Lets a contributor pay
 * any amount (defaults to outstanding balance) into an event contribution.
 * After the payment succeeds we ping the contributors API so the organiser
 * sees a pending entry in their queue.
 */
import CheckoutModal from "@/components/payments/CheckoutModal";
import { contributorsApi } from "@/lib/api/contributors";

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
  balance,
  onSubmitted,
}: Props) {
  return (
    <CheckoutModal
      open={open}
      onOpenChange={onOpenChange}
      targetType="event_contribution"
      targetId={eventId}
      amount={balance > 0 ? balance : undefined}
      amountEditable
      allowBank={false}
      title="Pay contribution"
      description={`For ${eventName}`}
      onSuccess={async (tx) => {
        try {
          await contributorsApi.selfContribute(eventId, {
            amount: tx.gross_amount,
            payment_reference: tx.transaction_code,
          });
        } catch { /* organiser will still see the wallet transaction */ }
        onSubmitted?.();
      }}
    />
  );
}

export default SelfContributeDialog;
