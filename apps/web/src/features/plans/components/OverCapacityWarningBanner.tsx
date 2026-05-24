import { Alert, Typography } from '@mui/material';
import type { OverCapacityWarning } from '@anna-maria/contracts';

interface Props {
  slots: OverCapacityWarning[];
}

export function OverCapacityWarningBanner({ slots }: Props) {
  if (slots.length === 0) return null;

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
        Atenção: horário(s) com turma cheia
      </Typography>
      {slots.map((s) => (
        <Typography key={s.scheduledAt} variant="body2">
          {new Date(s.scheduledAt).toLocaleString('pt-BR')} — {s.occupied}/4 alunos
        </Typography>
      ))}
    </Alert>
  );
}
