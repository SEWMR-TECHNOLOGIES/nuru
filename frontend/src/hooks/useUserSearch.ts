/**
 * Hook for searching Nuru platform users by name, email, or phone
 */
import { useState, useCallback, useRef } from "react";
import { get, buildQueryString } from "@/lib/api/helpers";

export interface SearchedUser {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  is_verified?: boolean;
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
        const response = await get<any>(
          `/users/search${buildQueryString({ q: query, limit: 10 })}`
        );
        if (response.success && response.data) {
          // API returns { items: [...] } with full_name/username, normalize to SearchedUser shape
          const rawItems = response.data.items || response.data.users || response.data || [];
          const items = Array.isArray(rawItems) ? rawItems : [];
          setResults(items.map((u: any) => ({
            id: u.id,
            first_name: u.first_name || (u.full_name ? u.full_name.split(' ')[0] : ''),
            last_name: u.last_name || (u.full_name ? u.full_name.split(' ').slice(1).join(' ') : ''),
            full_name: u.full_name,
            username: u.username || '',
            email: u.email || '',
            phone: u.phone || undefined,
            avatar: u.avatar || null,
            is_verified: u.is_verified,
          })));
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
