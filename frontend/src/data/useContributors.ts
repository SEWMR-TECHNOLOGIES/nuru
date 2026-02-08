/**
 * Data hooks for user contributors and event contributors
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
      const response = await contributorsApi.getEventContributors(eventId, params);
      if (response.success) {
        setEventContributors(response.data.event_contributors);
        setSummary(response.data.summary);
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
