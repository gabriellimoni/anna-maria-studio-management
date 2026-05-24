export interface ContractTemplate {
  id: string;
  name: string;
  bodyMarkdown: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractTemplateInput {
  name: string;
  bodyMarkdown: string;
}

export type UpdateContractTemplateInput = Partial<CreateContractTemplateInput> & {
  isActive?: boolean;
};

export interface ListContractTemplatesQuery {
  isActive?: boolean;
}

export interface PreviewContractTemplateInput {
  planId?: string;
}

export interface PreviewContractTemplateResponse {
  renderedHtml: string;
  resolvedVariables: Record<string, string>;
  missingVariables: string[];
}
