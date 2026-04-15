import { useState, useEffect, useRef, useCallback } from 'react';
import { searchApi, type GlobalSearchResults } from '@/lib/api/search';

export function useGlobalSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>({ people: [], events: [], services: [] });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ people: [], events: [], services: [] });
      setLoading(false);
      return;
    }

    // Cancel previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const data = await searchApi.globalSearch(q.trim(), 6);
      setResults(data);
      setIsOpen(true);
    } catch {
      // aborted or network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults({ people: [], events: [], services: [] });
      setIsOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => search(query), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [query, debounceMs, search]);

  const totalResults = results.people.length + results.events.length + results.services.length;

  return { query, setQuery, results, loading, isOpen, setIsOpen, totalResults };
}
