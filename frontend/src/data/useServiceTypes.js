import { useState } from "react";

export const useServiceTypes = () => {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchServiceTypes = async (categoryId) => {
    if (!categoryId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/references/service-types/category/${categoryId}`);
      const data = await res.json();

      if (data.success) {
        setServiceTypes(data.data);
      } else {
        setError(data.message || "Failed to fetch service types");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return { serviceTypes, loading, error, fetchServiceTypes };
};
