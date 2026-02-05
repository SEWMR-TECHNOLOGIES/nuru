import { useState, useEffect, useCallback } from "react";
import { api, UserService } from "@/lib/api";

export const useUserService = (serviceId: string | null) => {
  const [service, setService] = useState<UserService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchService = useCallback(async () => {
    if (!serviceId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.userServices.getById(serviceId);
      if (response.success) {
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
    if (serviceId) fetchService();
  }, [fetchService, serviceId]);

  return { service, loading, error, refetch: fetchService };
};
