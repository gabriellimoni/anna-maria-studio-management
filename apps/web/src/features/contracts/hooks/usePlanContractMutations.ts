import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MaterializePlanContractInput, UpdatePlanContractInput } from '@anna-maria/contracts';
import { planContractsApi } from '../api/planContracts';

export function useMaterializeContract(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MaterializePlanContractInput) => planContractsApi.materialize(planId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-contract', planId] }),
  });
}

export function useUpdateDraftContract(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePlanContractInput) => planContractsApi.updateDraft(planId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-contract', planId] }),
  });
}

export function useSendContract(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => planContractsApi.send(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-contract', planId] }),
  });
}

export function useCancelContract(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => planContractsApi.cancel(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-contract', planId] }),
  });
}
