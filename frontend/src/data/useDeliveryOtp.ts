/**
 * useDeliveryOtp — fetch + mutate the on-site check-in code for a booking.
 */

import { useCallback, useEffect, useState } from "react";
import { deliveryOtpApi, DeliveryOtpState } from "@/lib/api/deliveryOtp";
import { throwApiError } from "@/lib/api/showApiErrors";

export const useDeliveryOtp = (bookingId: string | null) => {
  const [state, setState] = useState<DeliveryOtpState | null>(null);
  const [loading, setLoading] = useState<boolean>(!!bookingId);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deliveryOtpApi.getState(bookingId);
      if (res.success) setState(res.data);
      else setError(res.message || "Failed to load OTP state");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load OTP state");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const arrive = async () => {
    if (!bookingId) return;
    const res = await deliveryOtpApi.arrive(bookingId);
    if (res.success) setState(res.data);
    else throwApiError(res);
    return res.data;
  };

  const verify = async (code: string) => {
    if (!bookingId) return { success: false, message: "No booking" };
    const res = await deliveryOtpApi.verify(bookingId, code);
    if (res.data) setState(res.data);
    return { success: res.success, message: res.message };
  };

  const cancel = async () => {
    if (!bookingId) return;
    const res = await deliveryOtpApi.cancel(bookingId);
    if (res.success) setState(res.data);
    else throwApiError(res);
    return res.data;
  };

  return { state, loading, error, refetch: fetchState, arrive, verify, cancel };
};
