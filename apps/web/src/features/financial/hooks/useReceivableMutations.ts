import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateReceivableManualInput, PayReceivableInput, UpdateReceivableInput } from '@anna-maria/contracts';
import { receivablesApi } from '../api/receivables';

export function useCreateReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReceivableManualInput) => receivablesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receivables'] }),
  });
}

export function useUpdateReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReceivableInput }) => receivablesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function usePayReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PayReceivableInput }) => receivablesApi.pay(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useUnpayReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => receivablesApi.unpay(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useMarkInvoiced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => receivablesApi.markInvoiced(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receivables'] }),
  });
}

export function useUnmarkInvoiced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => receivablesApi.unmarkInvoiced(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receivables'] }),
  });
}
