import { useState, useEffect, useCallback } from "react";

export const useUserServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/user-services/`,
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

      console.log("Fetched services response:", data);

      if (data.success) {
        setServices(data.data);
        console.log("Services set:", data.data);
      } else {
        setError(data.message || "Failed to fetch user services");
        console.error("Services fetch error:", data.message);
      }
    } catch (err) {
      setError(err.message || "An error occurred");
      console.error("Services fetch exception:", err);
    } finally {
      setLoading(false);
      console.log("Services loading finished");
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, refetch: fetchServices };
};
