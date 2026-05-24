import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { Cancel, CheckCircle } from '@mui/icons-material';
import type { Session, SessionStatus } from '@anna-maria/contracts';

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Agendado',
  present: 'Presente',
  absence_notified: 'Falta justificada',
  absence_unnotified: 'Falta',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<SessionStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  scheduled: 'primary',
  present: 'success',
  absence_notified: 'warning',
  absence_unnotified: 'error',
  cancelled: 'default',
};

interface Props {
  session: Session;
  onAttendance: (session: Session) => void;
  onCancel: (session: Session) => void;
}

export function SlotCard({ session, onAttendance, onCancel }: Props) {
  const isCancelled = session.status === 'cancelled';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        bgcolor: isCancelled ? 'action.disabledBackground' : 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>
          {session.studentName}
        </Typography>
        <Chip
          label={STATUS_LABELS[session.status]}
          color={STATUS_COLORS[session.status]}
          size="small"
          sx={{ fontSize: 11, height: 20, mt: 0.25 }}
        />
      </Box>
      <Tooltip title="Marcar presença/falta">
        <span>
          <IconButton size="small" onClick={() => onAttendance(session)} disabled={isCancelled}>
            <CheckCircle fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Cancelar aula">
        <span>
          <IconButton size="small" onClick={() => onCancel(session)} disabled={isCancelled}>
            <Cancel fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
