import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PaymentMethod } from '@anna-maria/contracts';
import { getApiError } from '../../../api/client';
import { useToast } from '../../../components/ToastProvider';
import { payablesApi } from '../api/payables';
import { useCreatePayable, useUpdatePayable } from '../hooks/usePayableMutations';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  card: 'Cartão',
  boleto: 'Boleto',
};

export function PayableFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const showToast = useToast();

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    payablesApi.get(id).then((p) => {
      setDescription(p.description);
      setCategory(p.category ?? '');
      setAmount(p.amount);
      setDueDate(p.dueDate);
      setPaymentMethod(p.paymentMethod ?? '');
      setLoading(false);
    });
  }, [id]);

  const createMutation = useCreatePayable();
  const updateMutation = useUpdatePayable();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    const data = {
      description,
      ...(category ? { category } : {}),
      amount,
      dueDate,
      ...(paymentMethod ? { paymentMethod } : {}),
    };

    if (isEdit) {
      updateMutation.mutate(
        { id, data },
        {
          onSuccess: () => {
            showToast('Lançamento atualizado', 'success');
            navigate('/financeiro/pagar');
          },
          onError: (err) => showToast(getApiError(err, 'Erro ao atualizar lançamento'), 'error'),
        },
      );
    } else {
      createMutation.mutate(data as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: () => {
          showToast('Lançamento criado', 'success');
          navigate('/financeiro/pagar');
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao criar lançamento'), 'error'),
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

  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {isEdit ? 'Editar lançamento' : 'Novo lançamento a pagar'}
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
          label="Valor (ex: 150.00)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="Vencimento"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          fullWidth
          required
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControl fullWidth>
          <InputLabel>Forma de pagamento</InputLabel>
          <Select
            value={paymentMethod}
            label="Forma de pagamento"
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
          >
            <MenuItem value="">Nenhuma</MenuItem>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <MenuItem key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => navigate('/financeiro/pagar')}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isPending || !description || !amount || !dueDate}
          >
            {isPending ? <CircularProgress size={20} /> : isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
