"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/features/auth/lib/auth-client";
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
  const credits = snapshot?.credits ?? 0;
  const dailyCredits = snapshot?.dailyCredits ?? 0;
  const paidCredits = snapshot?.paidCredits ?? 0;
  const history = snapshot?.history ?? [];

  const hasEnoughCredits = (cost: number) => credits >= cost;

  const invalidateCredits = () => {
    queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    queryClient.invalidateQueries({ queryKey: ["user-usage"] });
  };

  return {
    credits,
    dailyCredits,
    paidCredits,
    dailyAllowance: snapshot?.dailyAllowance ?? 100,
    dailyCreditDay: snapshot?.dailyCreditDay ?? "",
    nextDailyResetAt: snapshot?.nextDailyResetAt ?? "",
    serverTime: snapshot?.serverTime ?? "",
    history,
    hasEnoughCredits,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidateCredits,
  };
}
