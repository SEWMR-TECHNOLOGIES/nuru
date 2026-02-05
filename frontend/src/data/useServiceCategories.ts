import { useState, useEffect } from "react";
import { api, ServiceCategory } from "@/lib/api";

export const useServiceCategories = () => {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.references.getServiceCategories();
        if (response.success) {
          setCategories(response.data);
        } else {
          setError(response.message || "Failed to fetch service categories");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
};
