/**
 * openPaymentReceipt — opens the SAME premium receipt UI used everywhere
 * else in the app (Wallet, notifications, post-checkout) for any payment
 * row, including offline-confirmed ones.
 *
 * We deliberately do NOT roll our own popup-print here: the on-screen
 * receipt at /wallet/receipt/:transaction_code already has Preview / Print
 * built in (via ReportPreviewDialog + generateReceiptHtml), so navigating
 * there guarantees the printed page is byte-identical to what the user
 * sees first — no surprises, no UI drift between rows.
 */
import type { NavigateFunction } from "react-router-dom";
import type { ReceivedPayment } from "@/lib/api/receivedPayments";

export const openPaymentReceipt = (navigate: NavigateFunction, p: ReceivedPayment) => {
  if (!p?.transaction_code) return;
  navigate(`/wallet/receipt/${encodeURIComponent(p.transaction_code)}`);
};
