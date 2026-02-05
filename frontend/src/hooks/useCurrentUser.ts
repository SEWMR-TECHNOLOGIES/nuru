import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { api, User } from "@/lib/api";

export type { User as CurrentUser } from "@/lib/api";

const fetchCurrentUser = async (): Promise<User | null> => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    // Backend may return either ApiResponse<User> or a raw user object.
    // Normalize defensively.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await api.auth.me();

    if (response?.success === true) {
      const user = response.data as User;
      return {
        ...user,
        avatar: user.avatar || null,
      };
    }

    // Raw user object fallback (e.g. { id, first_name, ... })
    if (response?.id) {
      const user = response as User;
      return {
        ...user,
        avatar: user.avatar || null,
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
