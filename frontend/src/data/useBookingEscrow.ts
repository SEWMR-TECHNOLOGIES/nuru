/**
 * useBookingEscrow — fetch + mutate the escrow hold for a single booking.
 */

import { useCallback, useEffect, useState } from "react";
import { escrowApi, EscrowHold } from "@/lib/api/escrow";
import { throwApiError } from "@/lib/api/showApiErrors";

export const useBookingEscrow = (bookingId: string | null) => {
  const [hold, setHold] = useState<EscrowHold | null>(null);
  const [loading, setLoading] = useState<boolean>(!!bookingId);
  const [error, setError] = useState<string | null>(null);

  const fetchHold = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await escrowApi.getForBooking(bookingId);
      if (res.success) setHold(res.data);
      else setError(res.message || "Failed to load escrow");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load escrow");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchHold();
  }, [fetchHold]);

  const release = async (reason?: string) => {
    if (!bookingId) return;
    const res = await escrowApi.release(bookingId, reason);
    if (res.success) setHold(res.data);
    else throwApiError(res);
    return res.data;
  };

  const refund = async (amount: number, reason?: string) => {
    if (!bookingId) return;
    const res = await escrowApi.refund(bookingId, amount, reason);
    if (res.success) setHold(res.data);
    else throwApiError(res);
    return res.data;
  };

  return { hold, loading, error, refetch: fetchHold, release, refund };
};
