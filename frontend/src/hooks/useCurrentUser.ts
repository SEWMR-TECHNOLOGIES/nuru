import { useEffect } from "react";
import { useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { api, User } from "@/lib/api";
import { toast } from "sonner";

export type { User as CurrentUser } from "@/lib/api";

const normalizeUserPayload = (raw: any): User | null => {
  if (!raw?.id) return null;

  // Backend build_user_payload now returns a flat structure matching the API doc.
  // Support legacy nested format as fallback for backward compatibility.
  const profile = raw.profile || {};
  const stats = raw.stats || {};
  const roles = raw.roles || {};

  return {
    id: raw.id,
    first_name: raw.first_name,
    last_name: raw.last_name,
    username: raw.username,
    email: raw.email,
    phone: raw.phone,
    avatar: raw.avatar ?? profile.avatar ?? null,
    bio: raw.bio ?? profile.bio ?? undefined,
    location: raw.location ?? profile.location ?? undefined,
    is_email_verified: raw.is_email_verified,
    is_phone_verified: raw.is_phone_verified,
    is_active: raw.is_active,
    is_identity_verified: raw.is_identity_verified,
    is_vendor: raw.is_vendor ?? roles.is_vendor ?? false,
    follower_count: raw.follower_count ?? stats.followers ?? 0,
    following_count: raw.following_count ?? stats.following ?? 0,
    event_count: raw.event_count ?? stats.events_created ?? 0,
    service_count: raw.service_count ?? stats.services_count ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  } as User;
};

const fetchCurrentUser = async (): Promise<User | null> => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const response: any = await api.auth.me();

    if (response?.success === true) {
      return normalizeUserPayload(response.data);
    }

    // Raw user object fallback
    return normalizeUserPayload(response);
  } catch {
    return null;
  }
};

export const useCurrentUser = (): UseQueryResult<User | null> & { userIsLoggedIn: boolean } => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  // Listen for session-expired event from API helper
  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.setQueryData(["currentUser"], null);
      toast.error("Your session has expired. Please sign in again.");
      // Navigate to login
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [queryClient]);

  const userIsLoggedIn = !!query.data;

  return { ...query, userIsLoggedIn };
};
