import { useQuery } from '@tanstack/react-query';
import { publicContractsApi } from '../api/publicContracts';

export function usePublicContract(token: string) {
  return useQuery({
    queryKey: ['public-contract', token],
    queryFn: () => publicContractsApi.view(token),
    enabled: !!token,
    retry: false,
  });
}
