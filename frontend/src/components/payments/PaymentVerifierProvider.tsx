/**
 * PaymentVerifierProvider — browser-side background poller.
 *
 * Every POLL_MS the provider calls `/payments/pending` to find the user's
 * stale (>30s) pending transactions. For each row it then hits
 * `/payments/{id}/status` which already runs the gateway re-poll +
 * credit-on-success path. This lets the user keep using the app while
 * receipts confirm in the background.
 *
 * The provider mounts once at the app root. It is silent on failure (any
 * single tick can fail without affecting the user).
 *
 * The same logic also runs server-side via `POST /payments/verify-pending`
 * — that endpoint will be wired to a cron later. For now the browser is
 * the verifier when the user is online.
 */
import { useEffect, useRef } from "react";
import { get, post } from "@/lib/api/helpers";

const POLL_MS = 15_000;
const STATUS_TIMEOUT_MS = 12_000;

interface PendingResp {
  transactions: Array<{ id: string; transaction_code: string; status: string }>;
}

export default function PaymentVerifierProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const inFlight = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (inFlight.current) return;
      // Skip polling when not authenticated.
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) return;
      inFlight.current = true;
      try {
        const res = await get<PendingResp>("/payments/pending");
        const items = res?.data?.transactions || [];
        for (const t of items) {
          // Touch each one — backend re-polls gateway and credits if PAID.
          try {
            await Promise.race([
              get(`/payments/${encodeURIComponent(t.id)}/status`),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), STATUS_TIMEOUT_MS),
              ),
            ]);
            // Notify UI a payment may have transitioned.
            window.dispatchEvent(
              new CustomEvent("payments:status-refreshed", {
                detail: { id: t.id, transaction_code: t.transaction_code },
              }),
            );
          } catch {
            // Silent — try again next tick.
          }
        }
      } catch {
        // Silent.
      } finally {
        inFlight.current = false;
      }
    };

    // Kick off immediately, then on an interval.
    const id = window.setInterval(tick, POLL_MS);
    tick();
    return () => window.clearInterval(id);
  }, []);

  // Stub helper for callers that want to trigger the worker endpoint
  // manually (admin tools, debug page). Kept attached to window so other
  // pages can call it without importing.
  useEffect(() => {
    (window as any).__nuruVerifyPending = async () => {
      try {
        return await post("/payments/verify-pending", {});
      } catch (e) {
        return { success: false, error: String(e) };
      }
    };
    return () => {
      delete (window as any).__nuruVerifyPending;
    };
  }, []);

  return <>{children}</>;
}
