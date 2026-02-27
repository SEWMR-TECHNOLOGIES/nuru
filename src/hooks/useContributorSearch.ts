/**
 * Hook for searching user's contributor address book
 */
import { useState, useCallback, useRef } from "react";
import { contributorsApi, UserContributor } from "@/lib/api/contributors";

export const useContributorSearch = () => {
  const [results, setResults] = useState<UserContributor[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await contributorsApi.getAll({ search: query, limit: 10 });
        if (response.success && response.data?.contributors) {
          setResults(response.data.contributors);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, clear };
};
