import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { getApiError } from '../../../api/client';
import { useToast } from '../../../components/ToastProvider';
import { useRunRecurringGeneration } from '../hooks/useRunRecurringGeneration';

function getNextMonthValue(): string {
  const d = new Date();
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const y = nextMonth.getFullYear();
  const m = String(nextMonth.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RunGenerationDialog({ open, onClose }: Props) {
  const showToast = useToast();
  const [month, setMonth] = useState(getNextMonthValue);
  const mutation = useRunRecurringGeneration();

  function handleRun() {
    mutation.mutate(
      { competenceMonth: month },
      {
        onSuccess: (result) => {
          showToast(
            `Gerados: ${result.created}. Já existentes: ${result.skipped}.`,
            result.errors.length > 0 ? 'error' : 'success',
          );
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao gerar lançamentos'), 'error'),
      },
    );
  }

  function handleClose() {
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Gerar lançamentos a pagar</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Gera os lançamentos a pagar de todas as despesas ativas para o mês selecionado. Pode rodar
          várias vezes — duplicatas são impedidas automaticamente.
        </Typography>

        <TextField
          label="Mês de competência"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {mutation.isSuccess && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={mutation.data.errors.length > 0 ? 'warning' : 'success'}>
              Criados: {mutation.data.created}. Já existentes: {mutation.data.skipped}.
              {mutation.data.errors.length > 0 && (
                <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                  {mutation.data.errors.map((e) => (
                    <li key={e.ruleId}>
                      {e.description}: {e.error}
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fechar</Button>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={mutation.isPending || !month}
        >
          {mutation.isPending ? <CircularProgress size={20} /> : 'Gerar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
