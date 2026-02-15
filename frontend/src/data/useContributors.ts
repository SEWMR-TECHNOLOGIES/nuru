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
      const seenIds = new Set<string>();
      while (true) {
        const response = await contributorsApi.getEventContributors(eventId, {
          ...params,
          page: currentPage,
          limit: pageLimit,
        });

        if (response.success) {
          // Deduplicate by id
          for (const ec of response.data.event_contributors) {
            if (!seenIds.has(ec.id)) {
              seenIds.add(ec.id);
              allContributors.push(ec);
            }
          }
          // Capture summary & pagination from the FIRST page
          if (currentPage === 1) {
            firstSummary = response.data.summary;
            firstPagination = response.data.pagination;
          }

          // Stop if we've fetched all pages
          const totalPages = (currentPage === 1 ? firstPagination : response.data.pagination)?.total_pages || 1;
          console.log(`[Contributors] Page ${currentPage}/${totalPages}: got ${response.data.event_contributors.length} items, total unique so far: ${allContributors.length}, backend pagination:`, JSON.stringify(response.data.pagination), 'backend summary:', JSON.stringify(response.data.summary));
          if (currentPage >= totalPages) break;
          currentPage++;
        } else {
          setError(response.message || "Failed to fetch event contributors");
          break;
        }
      }

      // Use backend summary (computed from ALL records, not just paginated page)
      // Enrich with client-side counts from all fetched contributors
      const backendSummary = firstSummary || { total_pledged: 0, total_paid: 0, total_balance: 0, count: 0, currency: 'TZS' };
      const enrichedSummary = {
        ...backendSummary,
        total_balance: Math.max(0, (backendSummary.total_pledged || 0) - (backendSummary.total_paid || 0)),
        count: allContributors.length,
        pledged_count: allContributors.filter(c => (c.pledge_amount || 0) > 0).length,
        paid_count: allContributors.filter(c => (c.total_paid || 0) > 0).length,
      };

      setEventContributors(allContributors);
      setSummary(enrichedSummary);
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