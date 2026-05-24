export type PlanContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled';

export interface PlanContract {
  id: string;
  planId: string;
  templateId: string;
  templateVersion: number;
  status: PlanContractStatus;
  sentAt: string | null;
  signedAt: string | null;
  cancelledAt: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanContractDetail extends PlanContract {
  bodyMarkdown: string;
  renderedHtml: string | null;
  resolvedVariables: Record<string, string> | null;
  signatureImage: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  signerGeoCity: string | null;
  signerGeoRegion: string | null;
  publicUrl: string | null;
}

export interface MaterializePlanContractInput {
  templateId: string;
}

export interface UpdatePlanContractInput {
  bodyMarkdown: string;
}

export interface SendPlanContractResponse {
  publicUrl: string;
}

export interface PublicContractView {
  renderedHtml: string;
  status: PlanContractStatus;
  signedAt: string | null;
  pdfAvailable: boolean;
  studentName: string;
  studioName: string;
}

export interface SignContractInput {
  signatureImage: string;
}

export interface SignContractResponse {
  pdfUrl: string;
}
