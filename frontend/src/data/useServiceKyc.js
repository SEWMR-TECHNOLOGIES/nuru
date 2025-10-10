import { useState, useEffect } from "react";

export const useServiceKyc = (serviceTypeId) => {
  const [kycList, setKycList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!serviceTypeId) return;

    const fetchKyc = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/service-types/${serviceTypeId}/kyc`);
        const data = await res.json();

        if (data.success) {
          setKycList(data.data);
        } else {
          setError(data.message || "Failed to fetch KYC requirements");
        }
      } catch (err) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchKyc();
  }, [serviceTypeId]);

  return { kycList, loading, error };
};
