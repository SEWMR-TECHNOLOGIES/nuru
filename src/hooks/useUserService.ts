import { useState, useEffect, useCallback, useRef } from "react";
import { servicesApi, UserService } from "@/lib/api";

// Module-level cache to prevent skeleton flicker on back-navigation
const _serviceCache: Record<string, UserService> = {};

export const useUserService = (serviceId: string | null) => {
  const [service, setService] = useState<UserService | null>(
    serviceId ? _serviceCache[serviceId] || null : null
  );
  const initialLoad = useRef(!serviceId || !_serviceCache[serviceId!]);
  const [loading, setLoading] = useState(initialLoad.current);
  const [error, setError] = useState<string | null>(null);

  const fetchService = useCallback(async () => {
    if (!serviceId) return;

    // Only show loading on first load (no cache)
    if (initialLoad.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await servicesApi.getById(serviceId);
      if (response.success) {
        _serviceCache[serviceId] = response.data;
        setService(response.data);
      } else {
        setError(response.message || "Failed to fetch service details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      initialLoad.current = false;
    }
  }, [serviceId]);

  useEffect(() => {
    if (serviceId) fetchService();
  }, [fetchService, serviceId]);

  return { service, loading, error, refetch: fetchService };
};
