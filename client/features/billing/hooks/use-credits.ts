"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/features/auth/lib/auth-client";
import { resolveCreditWindow } from "../lib/plans";
import { CreditBalance } from "../types";

export function useCredits() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user-credits"],
    queryFn: async () => {
      return await apiClient<CreditBalance>("/api/user/credits");
    },
    enabled: !!session?.user,
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });

  const snapshot = query.data;
  const creditWindow = resolveCreditWindow(snapshot);
  const history = snapshot?.history ?? [];

  const hasEnoughCredits = (cost: number) =>
    creditWindow.bypassCredits || creditWindow.credits >= cost;

  const invalidateCredits = () => {
    queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    queryClient.invalidateQueries({ queryKey: ["user-usage"] });
  };

  return {
    ...creditWindow,
    history,
    hasEnoughCredits,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidateCredits,
  };
}
