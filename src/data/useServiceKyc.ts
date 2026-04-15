import { useState, useEffect } from "react";
import { api, KycRequirement } from "@/lib/api";

export const useServiceKyc = (serviceTypeId: string | null) => {
  const [kycList, setKycList] = useState<KycRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceTypeId) return;

    const fetchKyc = async () => {
      try {
        const response = await api.references.getServiceTypeKyc(serviceTypeId);
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
    };

    fetchKyc();
  }, [serviceTypeId]);

  return { kycList, loading, error };
};
