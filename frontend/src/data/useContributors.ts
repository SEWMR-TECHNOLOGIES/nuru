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
      // Fetch ALL event contributors in a single request (limit=1000)
      // This avoids multi-page pagination bugs caused by stateless serverless backends
      const response = await contributorsApi.getEventContributors(eventId, {
        ...params,
        page: 1,
        limit: 1000,
      });

      if (response.success) {
        const contributors = response.data.event_contributors;
        const backendSummary = response.data.summary || { total_pledged: 0, total_paid: 0, total_balance: 0, count: 0, currency: 'TZS' };

        const enrichedSummary = {
          ...backendSummary,
          total_balance: Math.max(0, (backendSummary.total_pledged || 0) - (backendSummary.total_paid || 0)),
          count: contributors.length,
          pledged_count: contributors.filter(c => (c.pledge_amount || 0) > 0).length,
          paid_count: contributors.filter(c => (c.total_paid || 0) > 0).length,
        };

        setEventContributors(contributors);
        setSummary(enrichedSummary);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch event contributors");
      }
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