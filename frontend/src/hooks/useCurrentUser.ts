import { useQuery, UseQueryResult } from "@tanstack/react-query";

export interface CurrentUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  avatar: string | null;
}

const fetchCurrentUser = async (): Promise<CurrentUser | null> => {
  const token = localStorage.getItem("token"); 
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/me`, {
    credentials: "include", 
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (!res.ok) return null;

  const data = await res.json();

  // Add avatar as null for now
  return {
    ...data,
    avatar: null
  };
};

export const useCurrentUser = (): UseQueryResult<CurrentUser | null> & { userIsLoggedIn: boolean } => {
  const query = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // don't retry on 401
  });

  const userIsLoggedIn = !!query.data;

  return { ...query, userIsLoggedIn };
};
