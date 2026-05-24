import {
  Box,
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { InstallmentInput } from '@anna-maria/contracts';
import { suggestInstallments } from '../utils/installments-suggester';

const PAYMENT_METHODS = [
  { value: '', label: '—' },
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'card', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
];

interface Props {
  value: InstallmentInput[];
  totalPrice: string;
  onChange: (installments: InstallmentInput[]) => void;
}

export function InstallmentsEditor({ value, totalPrice, onChange }: Props) {
  const [count, setCount] = [value.length, (n: number) => {
    const suggested = suggestInstallments(totalPrice || '0.00', n, value[0]?.dueDate || new Date().toISOString().slice(0, 10), 'monthly');
    onChange(suggested);
  }];

  const [firstDueDate, setFirstDueDate] = [value[0]?.dueDate || '', (d: string) => {
    const suggested = suggestInstallments(totalPrice || '0.00', value.length || 1, d, 'monthly');
    onChange(suggested);
  }];

  const total = value.reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0).toFixed(2);
  const target = parseFloat(totalPrice || '0');
  const diff = (parseFloat(total) - target).toFixed(2);
  const closes = Math.abs(parseFloat(diff)) <= 0.01;

  const update = (idx: number, patch: Partial<InstallmentInput>) => {
    const next = value.map((inst, i) => (i === idx ? { ...inst, ...patch } : inst));
    onChange(next);
  };

  const handleSuggest = () => {
    const d = firstDueDate || new Date().toISOString().slice(0, 10);
    const n = count || 1;
    onChange(suggestInstallments(totalPrice || '0.00', n, d, 'monthly'));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          size="small"
          label="Nº de parcelas"
          type="number"
          value={count || ''}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          sx={{ width: 130 }}
          slotProps={{ htmlInput: { min: 1, max: 24 } }}
        />
        <TextField
          size="small"
          label="Data da 1ª parcela"
          type="date"
          value={firstDueDate}
          onChange={(e) => setFirstDueDate(e.target.value)}
          sx={{ width: 180 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="outlined" size="small" onClick={handleSuggest}>
          Sugerir
        </Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Valor</TableCell>
            <TableCell>Vencimento</TableCell>
            <TableCell>Método</TableCell>
            <TableCell>Paga</TableCell>
            <TableCell>Data pagamento</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {value.map((inst, idx) => (
            <TableRow key={idx}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={inst.amount}
                  onChange={(e) => update(idx, { amount: e.target.value })}
                  sx={{ width: 100 }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="date"
                  value={inst.dueDate}
                  onChange={(e) => update(idx, { dueDate: e.target.value })}
                  sx={{ width: 150 }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </TableCell>
              <TableCell>
                <Select
                  size="small"
                  value={inst.paymentMethod ?? ''}
                  onChange={(e) => update(idx, { paymentMethod: e.target.value as any || undefined })}
                  sx={{ minWidth: 110 }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <Checkbox
                  size="small"
                  checked={inst.status === 'paid'}
                  onChange={(e) =>
                    update(idx, {
                      status: e.target.checked ? 'paid' : 'pending',
                      paidAt: e.target.checked ? (inst.paidAt ?? inst.dueDate) : undefined,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                {inst.status === 'paid' && (
                  <TextField
                    size="small"
                    type="date"
                    value={inst.paidAt ?? ''}
                    onChange={(e) => update(idx, { paidAt: e.target.value })}
                    sx={{ width: 150 }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                )}
              </TableCell>
              <TableCell>
                <IconButton
                  size="small"
                  onClick={() => onChange(value.filter((_, i) => i !== idx))}
                  disabled={value.length <= 1}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            px: 2,
            py: 0.75,
            borderRadius: 1,
            bgcolor: closes ? 'success.50' : 'error.50',
            border: '1px solid',
            borderColor: closes ? 'success.light' : 'error.light',
          }}
        >
          <Typography variant="body2" sx={{ color: closes ? 'success.dark' : 'error.dark', fontWeight: 600 }}>
            {closes ? `✓ Fecha ${totalPrice}` : `Diferença: ${parseFloat(diff) >= 0 ? '+' : ''}${diff}`}
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() =>
            onChange([...value, { amount: '0.00', dueDate: value[value.length - 1]?.dueDate ?? '' }])
          }
        >
          + Parcela
        </Button>
      </Box>
    </Box>
  );
}
