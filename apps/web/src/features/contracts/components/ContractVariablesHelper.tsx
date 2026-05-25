import { Box, Chip, Typography } from '@mui/material';

const VARIABLES = [
  'studentName',
  'studentEmail',
  'studentPhone',
  'studentCpf',
  'studentRg',
  'studentAddress',
  'studentAddressCity',
  'studentAddressState',
  'planName',
  'modality',
  'weeklyFrequency',
  'period',
  'startDate',
  'endDate',
  'totalPrice',
  'installmentsCount',
  'installmentValue',
  'paymentMethod',
  'studioOwnerName',
  'studioName',
  'todayDate',
];

interface Props {
  onInsert: (variable: string) => void;
}

export function ContractVariablesHelper({ onInsert }: Props) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Variáveis disponíveis (clique para inserir):
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {VARIABLES.map((v) => (
          <Chip
            key={v}
            label={`{{${v}}}`}
            size="small"
            variant="outlined"
            onClick={() => onInsert(`{{${v}}}`)}
            sx={{ fontFamily: 'monospace', cursor: 'pointer' }}
          />
        ))}
      </Box>
    </Box>
  );
}
