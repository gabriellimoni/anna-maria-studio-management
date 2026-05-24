import { useQuery } from '@tanstack/react-query';
import { planContractsApi } from '../api/planContracts';

export function usePlanContract(planId: string) {
  return useQuery({
    queryKey: ['plan-contract', planId],
    queryFn: () => planContractsApi.get(planId),
    enabled: !!planId,
    retry: (failureCount, error) => {
      // Don't retry 404 — plan may simply have no contract yet
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}
