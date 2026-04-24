import { useEffect, useRef } from 'react';

/**
 * Returns true when the user is on a fast-enough connection to safely prefetch.
 * - Skips if the Network Information API reports save-data
 * - Skips on slow effective connection types (slow-2g, 2g)
 * - Defaults to true when the API isn't available (desktop, Safari, etc.)
 */
export function isPrefetchAllowed(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn: any =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;
  if (!conn) return true;
  if (conn.saveData) return false;
  const effective = (conn.effectiveType || '').toLowerCase();
  if (effective === 'slow-2g' || effective === '2g') return false;
  return true;
}

/**
 * Attach a viewport-prefetch handler to a DOM node. When the node scrolls into
 * view (with a generous root-margin so we start fetching *before* it is visible),
 * the supplied prefetch callback runs exactly once.
 *
 * Automatically no-ops on slow / save-data connections and when
 * IntersectionObserver isn't available.
 *
 * Usage:
 *   const ref = usePrefetchOnVisible(() => prefetchEvent(event.id));
 *   <div ref={ref}>...</div>
 */
export function usePrefetchOnVisible<T extends HTMLElement = HTMLDivElement>(
  prefetch: () => void,
  options?: { rootMargin?: string; enabled?: boolean }
) {
  const ref = useRef<T | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (options?.enabled === false) return;
    if (firedRef.current) return;
    if (typeof window === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (!isPrefetchAllowed()) return;

    const node = ref.current;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            // Defer to idle time so we don't compete with the user's current
            // interaction or the initial paint.
            const ric =
              (window as any).requestIdleCallback ||
              ((cb: () => void) => setTimeout(cb, 1));
            ric(() => prefetch());
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: options?.rootMargin ?? '400px 0px', threshold: 0.01 }
    );

    io.observe(node);
    return () => io.disconnect();
    // We intentionally only re-bind when enabled flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.enabled]);

  return ref;
}
