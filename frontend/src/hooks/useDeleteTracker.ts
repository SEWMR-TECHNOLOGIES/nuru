/**
 * Tracks in-flight delete operations for consistent progress UI.
 * Components can check if an item is being deleted and show a spinner overlay.
 */
import { useState, useCallback } from "react";

export const useDeleteTracker = () => {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const trackDelete = useCallback(async (id: string, deleteFn: () => Promise<void>) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await deleteFn();
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const isDeleting = useCallback((id: string) => deletingIds.has(id), [deletingIds]);

  return { deletingIds, trackDelete, isDeleting };
};
