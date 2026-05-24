import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import type { Session, UpdateSessionInput } from '@anna-maria/contracts';
import { useUpdateSession } from '../hooks/useSessionMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

interface FormProps {
  session: Session;
  onClose: () => void;
}

function AttendanceForm({ session, onClose }: FormProps) {
  const showToast = useToast();
  const update = useUpdateSession();
  const [status, setStatus] = useState<UpdateSessionInput['status']>(
    session.status === 'cancelled' ? 'scheduled' : (session.status as UpdateSessionInput['status']),
  );
  const [notes, setNotes] = useState(session.notes ?? '');

  const handleConfirm = () => {
    update.mutate(
      { id: session.id, data: { status, notes: notes || undefined } },
      {
        onSuccess: () => {
          showToast('Atendimento atualizado', 'success');
          onClose();
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao atualizar'), 'error'),
      },
    );
  };

  return (
    <>
      <DialogTitle>Marcar presença — {session.studentName}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <FormControl fullWidth size="small">
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={status ?? 'scheduled'}
            onChange={(e) => setStatus(e.target.value as UpdateSessionInput['status'])}
          >
            <MenuItem value="scheduled">Agendado</MenuItem>
            <MenuItem value="present">Presente</MenuItem>
            <MenuItem value="absence_notified">Falta justificada</MenuItem>
            <MenuItem value="absence_unnotified">Falta não justificada</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Observações"
          multiline
          rows={3}
          size="small"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={update.isPending}>
          Salvar
        </Button>
      </DialogActions>
    </>
  );
}

interface Props {
  open: boolean;
  session: Session | null;
  onClose: () => void;
}

export function AttendanceDialog({ open, session, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {session && <AttendanceForm key={session.id} session={session} onClose={onClose} />}
    </Dialog>
  );
}
