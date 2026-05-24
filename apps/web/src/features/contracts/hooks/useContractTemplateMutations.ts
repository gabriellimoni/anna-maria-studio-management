import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateContractTemplateInput,
  PreviewContractTemplateInput,
  UpdateContractTemplateInput,
} from '@anna-maria/contracts';
import { contractTemplatesApi } from '../api/contractTemplates';

export function useCreateContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContractTemplateInput) => contractTemplatesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  });
}

export function useUpdateContractTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateContractTemplateInput) => contractTemplatesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  });
}

export function useArchiveContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractTemplatesApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  });
}

export function usePreviewContractTemplate(id: string) {
  return useMutation({
    mutationFn: (data: PreviewContractTemplateInput) => contractTemplatesApi.preview(id, data),
  });
}
