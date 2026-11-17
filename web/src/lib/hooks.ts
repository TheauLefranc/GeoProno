import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "./api";

export interface PublicConfig {
  allowedEmailDomains: string[];
  oddsFeatureEnabled: boolean;
  votesRequired: number;
  refillThreshold: number;
  refillHour: number;
  minStake: number;
  maxStake: number;
}

export function usePublicConfig() {
  return useQuery({ queryKey: ["public-config"], queryFn: () => api<PublicConfig>("/auth/config"), staleTime: 5 * 60_000 });
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Mutation that refreshes the given queries (and the balance) on success. */
export function useAction<TVars, TRes>(fn: (v: TVars) => Promise<TRes>, invalidate: QueryKey[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["bets"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      for (const k of invalidate) qc.invalidateQueries({ queryKey: k });
    },
  });
}
