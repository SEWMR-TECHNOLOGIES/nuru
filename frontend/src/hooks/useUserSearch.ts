/**
 * Hook for searching Nuru platform users by name, email, or phone
 */
import { useState, useCallback, useRef } from "react";
import { get, buildQueryString } from "@/lib/api/helpers";

export interface SearchedUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string | null;
}

export const useUserSearch = () => {
  const [results, setResults] = useState<SearchedUser[]>([]);
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
        const response = await get<{ users: SearchedUser[] }>(
          `/users/search${buildQueryString({ q: query, limit: 10 })}`
        );
        if (response.success && response.data?.users) {
          setResults(response.data.users);
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
