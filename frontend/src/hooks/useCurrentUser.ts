import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { api, User } from "@/lib/api";

export type { User as CurrentUser } from "@/lib/api";

const fetchCurrentUser = async (): Promise<User | null> => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const response = await api.auth.me();
    if (response.success) {
      return {
        ...response.data,
        avatar: response.data.avatar || null,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const useCurrentUser = (): UseQueryResult<User | null> & { userIsLoggedIn: boolean } => {
  const query = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const userIsLoggedIn = !!query.data;

  return { ...query, userIsLoggedIn };
};
