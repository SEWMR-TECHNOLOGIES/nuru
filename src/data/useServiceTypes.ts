import { useState } from "react";
import { api, ServiceType } from "@/lib/api";

const _serviceTypesCache = new Map<string, ServiceType[]>();

export const useServiceTypes = () => {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServiceTypes = async (categoryId: string) => {
    if (!categoryId) return;

    if (_serviceTypesCache.has(categoryId)) {
      setServiceTypes(_serviceTypesCache.get(categoryId) || []);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.references.getServiceTypesByCategory(categoryId);
      if (response.success) {
        _serviceTypesCache.set(categoryId, response.data);
        setServiceTypes(response.data);
      } else {
        setError(response.message || "Failed to fetch service types");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return { serviceTypes, loading, error, fetchServiceTypes };
};
