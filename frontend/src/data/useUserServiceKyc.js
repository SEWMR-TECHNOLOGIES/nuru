import { useState, useEffect, useCallback } from "react";

export const useServiceKyc = (serviceId) => {
  const [kycList, setKycList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKyc = useCallback(async () => {
    if (!serviceId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/user-services/${serviceId}/kyc`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
        }
      );

      const data = await res.json();

      console.log("Fetched KYC response:", data);

      if (data.success) {
        setKycList(data.data);
        console.log("KYC List set:", data.data);
      } else {
        setError(data.message || "Failed to fetch KYC requirements");
        console.error("KYC fetch error:", data.message);
      }
    } catch (err) {
      setError(err.message || "An error occurred");
      console.error("KYC fetch exception:", err);
    } finally {
      setLoading(false);
      console.log("KYC loading finished");
    }
  }, [serviceId]);

  useEffect(() => {
    fetchKyc();
  }, [fetchKyc]);

  return { kycList, loading, error, refetch: fetchKyc };
};
