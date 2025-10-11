import { useState, useEffect } from "react";

export const useServiceKyc = (serviceTypeId) => {
  const [kycList, setKycList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!serviceTypeId) return;

    const fetchKyc = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/references/service-types/${serviceTypeId}/kyc`
        );
        const data = await res.json();

        console.log("Fetched KYC response:", data); // <-- log full response

        if (data.success) {
          setKycList(data.data);
          console.log("KYC List set:", data.data); // <-- log extracted KYC list
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
    };

    fetchKyc();
  }, [serviceTypeId]);

  return { kycList, loading, error };
};
