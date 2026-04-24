/**
 * useMyContributions — events where the logged-in user is listed as a contributor.
 * Module-level cache to survive remounts. Supports an optional `search` param
 * that re-fetches from the backend (server-side filter).
 */
import { useCallback, useEffect, useState } from "react";
import { contributorsApi, MyContributionEvent } from "@/lib/api/contributors";

let _cache: MyContributionEvent[] | null = null;

export const useMyContributions = (search: string = "") => {
  const [events, setEvents] = useState<MyContributionEvent[]>(_cache ?? []);
  const [loading, setLoading] = useState(_cache === null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (overrideSearch?: string) => {
    const term = overrideSearch ?? search;
    if (_cache === null && !term) setLoading(true);
    if (term) setLoading(true);
    try {
      const res = await contributorsApi.getMyContributions(term ? { search: term } : undefined);
      if (res.success) {
        const list = res.data.events || [];
        if (!term) _cache = list; // Only cache the unfiltered list.
        setEvents(list);
        setError(null);
      } else {
        setError(res.message || "Failed to load contributions");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load contributions");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { events, loading, error, refetch };
};
