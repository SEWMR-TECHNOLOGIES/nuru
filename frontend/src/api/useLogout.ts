import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to logout");

      // Clear local auth token
      localStorage.removeItem("token");

      // Clear currentUser cache so hook/UI updates immediately
      queryClient.setQueryData(["currentUser"], null);
      // Optionally clear all queries or more specific keys:
      // queryClient.clear(); // use with care in big apps

      // Broadcast logout to other tabs
      window.localStorage.setItem("logout", Date.now().toString());

      toast.success("Signed out successfully");

      // Navigate to landing (no reload)
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to sign out. Try again.");
    }
  };

  return { logout };
};
