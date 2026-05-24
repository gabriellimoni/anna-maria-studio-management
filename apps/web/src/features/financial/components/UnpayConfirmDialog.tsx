import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface UnpayConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function UnpayConfirmDialog({ open, onClose, onConfirm, loading }: UnpayConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Estornar pagamento</DialogTitle>
      <DialogContent>
        <Typography>
          Deseja reverter o pagamento desta parcela? Ela voltará para &ldquo;pendente&rdquo;.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button color="error" onClick={onConfirm} disabled={loading}>
          Estornar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
