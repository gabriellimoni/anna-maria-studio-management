import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SignContractInput } from '@anna-maria/contracts';
import { publicContractsApi } from '../api/publicContracts';

export function useSignPublicContract(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SignContractInput) => publicContractsApi.sign(token, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-contract', token] }),
  });
}
