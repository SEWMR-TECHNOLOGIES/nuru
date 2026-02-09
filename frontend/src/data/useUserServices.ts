import { useState, useEffect, useCallback } from "react";
import { api, UserService, servicesApi } from "@/lib/api";

interface ServicesSummary {
  total_services: number;
  active_services: number;
  verified_services: number;
  pending_verification: number;
  total_reviews: number;
  average_rating: number;
}

export const useUserServices = () => {
  const [services, setServices] = useState<UserService[]>([]);
  const [summary, setSummary] = useState<ServicesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.userServices.getAll();
      if (response.success && response.data) {
        // API returns { services: [...], summary: {...} } per nuru-api-doc
        const data = response.data as any;
        if (data.services && Array.isArray(data.services)) {
          setServices(data.services);
          setSummary(data.summary || null);
        } else if (Array.isArray(data)) {
          setServices(data);
        } else {
          setServices([]);
        }
      } else {
        setError(response.message || "Failed to fetch user services");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, summary, loading, error, refetch: fetchServices };
};

// ============================================================================
// ALL SERVICES (for FindServices page - public listing)
// ============================================================================

export const useServices = (params?: { category?: string; location?: string; search?: string }) => {
  const [services, setServices] = useState<UserService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await servicesApi.search(params);
      if (response.success) {
        setServices(response.data.services);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch services");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, pagination, refetch: fetchServices };
};
