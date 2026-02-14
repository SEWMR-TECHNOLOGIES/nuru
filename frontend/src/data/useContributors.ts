/**
 * Data hooks for user contributors and event contributors
 * FIXED: Auto-pagination to load all contributors (not just first 50)
 */
import { useState, useEffect, useCallback } from "react";
import { contributorsApi, UserContributor, EventContributorSummary, ContributorPayment } from "@/lib/api/contributors";
import { throwApiError } from "@/lib/api/showApiErrors";

// ============================================================================
// EVENT CONTRIBUTORS
// ============================================================================

export const useEventContributors = (eventId: string | null) => {
  const [eventContributors, setEventContributors] = useState<EventContributorSummary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchEventContributors = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
    if (!eventId) return;
    try {
      let allContributors: EventContributorSummary[] = [];
      let currentPage = 1;
      const pageLimit = 100; // backend max limit
      let firstSummary: any = null;
      let firstPagination: any = null;

      // Auto-paginate through all pages
      while (true) {
        const response = await contributorsApi.getEventContributors(eventId, {
          ...params,
          page: currentPage,
          limit: pageLimit,
        });

        if (response.success) {
          allContributors = [...allContributors, ...response.data.event_contributors];
          // Capture summary & pagination from the FIRST page (backend aggregates are only on page 1)
          if (currentPage === 1) {
            firstSummary = response.data.summary;
            firstPagination = response.data.pagination;
          }

          // Stop if we've fetched all pages
          const totalPages = (currentPage === 1 ? firstPagination : response.data.pagination)?.total_pages || 1;
          if (currentPage >= totalPages) break;
          currentPage++;
        } else {
          setError(response.message || "Failed to fetch event contributors");
          break;
        }
      }

      // Compute summary client-side from ALL contributors (backend summary is per-page, not global)
      const computedSummary = {
        total_pledged: allContributors.reduce((sum, c) => sum + (c.pledge_amount || 0), 0),
        total_paid: allContributors.reduce((sum, c) => sum + (c.total_paid || 0), 0),
        total_balance: allContributors.reduce((sum, c) => sum + (c.balance || 0), 0),
        count: allContributors.length,
        pledged_count: allContributors.filter(c => (c.pledge_amount || 0) > 0).length,
        paid_count: allContributors.filter(c => (c.total_paid || 0) > 0).length,
        currency: firstSummary?.currency || 'TZS',
      };

      setEventContributors(allContributors);
      setSummary(computedSummary);
      setPagination(firstPagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchEventContributors();
  }, [fetchEventContributors, eventId]);

  const addToEvent = async (data: Parameters<typeof contributorsApi.addToEvent>[1]) => {
    if (!eventId) return null;
    try {
      const response = await contributorsApi.addToEvent(eventId, data);
      if (response.success) {
        await fetchEventContributors();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const updateEventContributor = async (ecId: string, data: { pledge_amount?: number; notes?: string }) => {
    if (!eventId) return null;
    try {
      const response = await contributorsApi.updateEventContributor(eventId, ecId, data);
      if (response.success) {
        await fetchEventContributors();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const removeFromEvent = async (ecId: string) => {
    if (!eventId) return;
    try {
      const response = await contributorsApi.removeFromEvent(eventId, ecId);
      if (response.success) {
        await fetchEventContributors();
      } else {
        throwApiError(response);
      }
    } catch (err) {
      throw err;
    }
  };

  const recordPayment = async (ecId: string, data: { amount: number; payment_method?: string; payment_reference?: string }) => {
    if (!eventId) return null;
    try {
      const response = await contributorsApi.recordPayment(eventId, ecId, data);
      if (response.success) {
        await fetchEventContributors();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const getPaymentHistory = async (ecId: string) => {
    if (!eventId) return null;
    try {
      const response = await contributorsApi.getPaymentHistory(eventId, ecId);
      if (response.success) {
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return {
    eventContributors,
    summary,
    loading,
    error,
    pagination,
    refetch: fetchEventContributors,
    addToEvent,
    updateEventContributor,
    removeFromEvent,
    recordPayment,
    getPaymentHistory,
  };
};