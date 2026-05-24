import { useQuery } from '@tanstack/react-query';
import type { ListContractTemplatesQuery } from '@anna-maria/contracts';
import { contractTemplatesApi } from '../api/contractTemplates';

export function useContractTemplates(query?: ListContractTemplatesQuery) {
  return useQuery({
    queryKey: ['contract-templates', query],
    queryFn: () => contractTemplatesApi.list(query),
  });
}

export function useContractTemplate(id: string) {
  return useQuery({
    queryKey: ['contract-templates', id],
    queryFn: () => contractTemplatesApi.get(id),
    enabled: !!id,
  });
}
