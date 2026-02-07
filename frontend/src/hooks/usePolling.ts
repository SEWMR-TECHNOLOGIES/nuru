/**
 * Generic polling hook - calls refetch at a given interval.
 * IMPORTANT: Uses a ref for refetch to avoid re-triggering the interval
 * and does NOT cause component re-renders or visible reloads.
 */
import { useEffect, useRef } from "react";

export const usePolling = (refetch: (() => void) | undefined, intervalMs = 15000, enabled = true) => {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!enabled || !refetchRef.current) return;

    const id = setInterval(() => {
      refetchRef.current?.();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
};
