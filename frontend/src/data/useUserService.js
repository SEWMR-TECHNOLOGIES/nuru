import { useState, useEffect, useCallback } from "react";

export const useUserServiceDetails = (serviceId) => {
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServiceDetails = useCallback(async () => {
    if (!serviceId) return;

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
      console.log("Fetched service details:", data);

      if (data.success) {
        setService(data.data);
      } else {
        setError(data.message || "Failed to fetch service details");
        console.error("Service details fetch error:", data.message);
      }
    } catch (err) {
      setError(err.message || "An error occurred");
      console.error("Service details fetch exception:", err);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchServiceDetails();
  }, [fetchServiceDetails]);

  return { service, loading, error, refetch: fetchServiceDetails };
};
