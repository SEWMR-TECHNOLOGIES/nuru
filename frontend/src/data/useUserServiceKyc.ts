import { useState, useEffect, useCallback } from "react";
import { api, KycRequirement } from "@/lib/api";

export const useUserServiceKyc = (serviceId: string | null) => {
  const [kycList, setKycList] = useState<KycRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKyc = useCallback(async () => {
    if (!serviceId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.userServices.getKyc(serviceId);
      if (response.success) {
        setKycList(response.data);
      } else {
        setError(response.message || "Failed to fetch KYC requirements");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchKyc();
  }, [fetchKyc]);

  return { kycList, loading, error, refetch: fetchKyc };
};
