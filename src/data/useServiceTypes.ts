import { useState } from "react";
import { api, ServiceType } from "@/lib/api";

export const useServiceTypes = () => {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServiceTypes = async (categoryId: string) => {
    if (!categoryId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.references.getServiceTypesByCategory(categoryId);
      if (response.success) {
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
