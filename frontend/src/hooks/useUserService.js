import { useState, useEffect, useCallback } from "react";

export const useUserService = (serviceId) => {
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchService = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/user-services/${serviceId}`,
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
      if (data.success) {
        setService(data.data);
      } else {
        setError(data.message || "Failed to fetch service details");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    } 
  }, [serviceId]);

  useEffect(() => {
    if (serviceId) fetchService();
  }, [fetchService, serviceId]);

  return { service, loading, error, refetch: fetchService };
};
