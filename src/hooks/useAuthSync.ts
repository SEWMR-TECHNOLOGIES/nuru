import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export function useAuthSync() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key) return;

      if (event.key === "logout") {
        console.log("Detected logout in another tab");

        queryClient.setQueryData(["currentUser"], null);

        navigate("/", { replace: true });
      }

      if (event.key === "login") {
        console.log("Detected login in another tab");

        // Refresh current user data
        queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate, queryClient]);
}
