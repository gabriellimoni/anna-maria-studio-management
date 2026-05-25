import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CancelPlanInput, ChangeScheduleInput, CreatePlanInput, RenewPlanInput } from '@anna-maria/contracts';
import { plansApi } from '../api/plans';

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanInput) => plansApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useChangeSchedule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ChangeScheduleInput) => plansApi.changeSchedule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', id] }),
  });
}

export function useRenewPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RenewPlanInput) => plansApi.renew(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useCancelPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelPlanInput) => plansApi.cancel(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', id] }),
  });
}

export function useFinishPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => plansApi.finish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useCheckCapacity() {
  return useMutation({
    mutationFn: (p: { weekday: number; startTime: string; from: string; to: string }) =>
      plansApi.checkCapacity(p),
  });
}
