import { useState, useEffect, useCallback } from "react";
import { api, UserService } from "@/lib/api";

const _userServiceDetailsCache = new Map<string, UserService>();

export const useUserServiceDetails = (serviceId: string | null) => {
  const cached = serviceId ? _userServiceDetailsCache.get(serviceId) : null;
  const [service, setService] = useState<UserService | null>(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchServiceDetails = useCallback(async () => {
    if (!serviceId) return;
    if (!_userServiceDetailsCache.has(serviceId)) setLoading(true);
    setError(null);
    try {
      const response = await api.userServices.getById(serviceId);
      if (response.success) {
        _userServiceDetailsCache.set(serviceId, response.data);
        setService(response.data);
      } else {
        setError(response.message || "Failed to fetch service details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchServiceDetails();
  }, [fetchServiceDetails]);

  return { service, loading, error, refetch: fetchServiceDetails };
};
