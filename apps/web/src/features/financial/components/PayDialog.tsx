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
import type { PaymentMethod } from '@anna-maria/contracts';

interface PayDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (paidAt: string, paymentMethod: PaymentMethod) => void;
  loading?: boolean;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  card: 'Cartão',
  boleto: 'Boleto',
};

export function PayDialog({ open, onClose, onConfirm, loading }: PayDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [paidAt, setPaidAt] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  function handleConfirm() {
    onConfirm(paidAt, paymentMethod);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar pagamento</DialogTitle>
      <DialogContent>
        <TextField
          label="Data do pagamento"
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControl fullWidth>
          <InputLabel>Forma de pagamento</InputLabel>
          <Select
            value={paymentMethod}
            label="Forma de pagamento"
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <MenuItem key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={loading || !paidAt}>
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
