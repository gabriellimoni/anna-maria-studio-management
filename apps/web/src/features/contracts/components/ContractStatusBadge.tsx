import { Chip } from '@mui/material';
import type { PlanContractStatus } from '@anna-maria/contracts';

const STATUS_LABELS: Record<PlanContractStatus, string> = {
  draft: 'Rascunho',
  sent: 'Aguardando assinatura',
  signed: 'Assinado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<PlanContractStatus, 'default' | 'warning' | 'success' | 'error'> = {
  draft: 'default',
  sent: 'warning',
  signed: 'success',
  cancelled: 'error',
};

interface Props {
  status: PlanContractStatus;
}

export function ContractStatusBadge({ status }: Props) {
  return <Chip label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} size="small" />;
}
