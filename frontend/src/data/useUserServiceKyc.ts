import { useState, useEffect, useCallback } from "react";
import { api, KycRequirement } from "@/lib/api";

const _userServiceKycCache = new Map<string, KycRequirement[]>();

export const useUserServiceKyc = (serviceId: string | null) => {
  const cached = serviceId ? _userServiceKycCache.get(serviceId) : null;
  const [kycList, setKycList] = useState<KycRequirement[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchKyc = useCallback(async () => {
    if (!serviceId) return;
    if (!_userServiceKycCache.has(serviceId)) setLoading(true);
    setError(null);
    try {
      const response = await api.userServices.getKyc(serviceId);
      if (response.success) {
        _userServiceKycCache.set(serviceId, response.data);
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
