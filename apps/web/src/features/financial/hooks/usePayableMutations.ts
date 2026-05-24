import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatePayableManualInput, PayPayableInput, UpdatePayableInput } from '@anna-maria/contracts';
import { payablesApi } from '../api/payables';

export function useCreatePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePayableManualInput) => payablesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payables'] }),
  });
}

export function useUpdatePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayableInput }) => payablesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payables'] }),
  });
}

export function usePayPayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PayPayableInput }) => payablesApi.pay(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payables'] }),
  });
}

export function useUnpayPayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payablesApi.unpay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payables'] }),
  });
}
