import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError } from '../../../api/client';
import { useToast } from '../../../components/ToastProvider';
import { recurringExpensesApi } from '../api/recurring-expenses';
import { useCreateRecurringExpense, useUpdateRecurringExpense } from '../hooks/useRecurringExpenseMutations';

const DUE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export function RecurringExpenseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const showToast = useToast();

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [dueDay, setDueDay] = useState<number>(10);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    recurringExpensesApi.get(id).then((r) => {
      setDescription(r.description);
      setCategory(r.category ?? '');
      setExpectedAmount(r.expectedAmount);
      setDueDay(r.dueDay);
      setIsActive(r.isActive);
      setLoading(false);
    });
  }, [id]);

  const createMutation = useCreateRecurringExpense();
  const updateMutation = useUpdateRecurringExpense();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    const data = {
      description,
      ...(category ? { category } : {}),
      expectedAmount,
      dueDay,
    };

    if (isEdit) {
      updateMutation.mutate(
        { id, data: { ...data, isActive } },
        {
          onSuccess: () => {
            showToast('Despesa recorrente atualizada', 'success');
            navigate('/financeiro/despesas-recorrentes');
          },
          onError: (err) => showToast(getApiError(err, 'Erro ao atualizar'), 'error'),
        },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          showToast('Despesa recorrente criada', 'success');
          navigate('/financeiro/despesas-recorrentes');
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao criar'), 'error'),
      });
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const isValid = description && expectedAmount && /^\d+\.\d{2}$/.test(expectedAmount) && dueDay >= 1 && dueDay <= 28;

  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {isEdit ? 'Editar despesa recorrente' : 'Nova despesa recorrente'}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          fullWidth
        />
        <TextField
          label="Valor esperado (ex: 2500.00)"
          value={expectedAmount}
          onChange={(e) => setExpectedAmount(e.target.value)}
          fullWidth
          required
          helperText="Formato: 1234.56"
        />

        <FormControl fullWidth required>
          <InputLabel>Dia do vencimento mensal</InputLabel>
          <Select
            value={dueDay}
            label="Dia do vencimento mensal"
            onChange={(e) => setDueDay(Number(e.target.value))}
          >
            {DUE_DAYS.map((d) => (
              <MenuItem key={d} value={d}>
                Dia {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {isEdit && (
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Ativa"
          />
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => navigate('/financeiro/despesas-recorrentes')}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isPending || !isValid}
          >
            {isPending ? <CircularProgress size={20} /> : isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
