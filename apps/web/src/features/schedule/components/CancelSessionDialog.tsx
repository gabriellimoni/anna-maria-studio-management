import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useState } from 'react';
import type { Session } from '@anna-maria/contracts';
import { useCancelSession } from '../hooks/useSessionMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

interface FormProps {
  session: Session;
  onClose: () => void;
}

function CancelForm({ session, onClose }: FormProps) {
  const showToast = useToast();
  const cancel = useCancelSession();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    cancel.mutate(
      { id: session.id, data: { reason: reason || undefined } },
      {
        onSuccess: () => {
          showToast('Aula cancelada', 'success');
          onClose();
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao cancelar'), 'error'),
      },
    );
  };

  return (
    <>
      <DialogTitle>Cancelar aula — {session.studentName}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <TextField
          label="Motivo (opcional)"
          placeholder="Ex.: Feriado nacional"
          multiline
          rows={3}
          fullWidth
          size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Voltar</Button>
        <Button variant="contained" color="error" onClick={handleConfirm} disabled={cancel.isPending}>
          Confirmar cancelamento
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

export function CancelSessionDialog({ open, session, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {session && <CancelForm key={session.id} session={session} onClose={onClose} />}
    </Dialog>
  );
}
