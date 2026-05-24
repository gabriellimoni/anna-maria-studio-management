import { Box, Chip } from '@mui/material';

const OPTIONS = [
  { label: 'Próximos 7 dias', value: 7 },
  { label: 'Próximos 30 dias', value: 30 },
  { label: 'Próximos 60 dias', value: 60 },
  { label: 'Próximos 90 dias', value: 90 },
] as const;

interface Props {
  value?: 7 | 30 | 60 | 90;
  onChange: (value?: 7 | 30 | 60 | 90) => void;
}

export function ExpiryFilterChips({ value, onChange }: Props) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {OPTIONS.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          clickable
          color={value === opt.value ? 'warning' : 'default'}
          variant={value === opt.value ? 'filled' : 'outlined'}
          onClick={() => onChange(value === opt.value ? undefined : opt.value)}
        />
      ))}
    </Box>
  );
}
