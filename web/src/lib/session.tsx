import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type User } from "./api";

export function useSession() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await api<{ user: User }>("/auth/me")).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
  });
  return { user: q.data ?? null, loading: q.isLoading, error: q.error };
}

export function useSetUser() {
  const qc = useQueryClient();
  return (user: User | null) => qc.setQueryData(["me"], user);
}

/** Refreshes everything that depends on balances and bets. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export const isStaff = (u: User | null) => u?.role === "ADMIN" || u?.role === "MODERATOR";
