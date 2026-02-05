import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      const response = await api.auth.logout();

      if (!response.success) throw new Error("Failed to logout");

      // Clear local auth token
      localStorage.removeItem("token");

      // Clear currentUser cache so hook/UI updates immediately
      queryClient.setQueryData(["currentUser"], null);

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
