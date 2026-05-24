import { Box, Chip, TextField } from '@mui/material';

export type FinancialStatusFilter = 'all' | 'pending' | 'paid' | 'overdue';

interface FinancialFiltersBarProps {
  status: FinancialStatusFilter;
  onStatusChange: (s: FinancialStatusFilter) => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
}

const STATUS_OPTIONS: { value: FinancialStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'paid', label: 'Pagas' },
  { value: 'overdue', label: 'Atrasadas' },
];

export function FinancialFiltersBar({
  status,
  onStatusChange,
  from,
  onFromChange,
  to,
  onToChange,
}: FinancialFiltersBarProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
      {STATUS_OPTIONS.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          onClick={() => onStatusChange(opt.value)}
          color={status === opt.value ? (opt.value === 'overdue' ? 'error' : 'primary') : 'default'}
          variant={status === opt.value ? 'filled' : 'outlined'}
        />
      ))}
      <TextField
        label="De"
        type="date"
        size="small"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 160 }}
      />
      <TextField
        label="Até"
        type="date"
        size="small"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 160 }}
      />
    </Box>
  );
}
