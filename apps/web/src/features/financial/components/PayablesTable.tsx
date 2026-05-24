import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Payable } from '@anna-maria/contracts';

interface PayablesTableProps {
  rows: Payable[];
  onPay: (p: Payable) => void;
  onUnpay: (p: Payable) => void;
  onEdit: (p: Payable) => void;
}

function StatusChip({ p }: { p: Payable }) {
  if (p.isOverdue) return <Chip label="ATRASADA" color="error" size="small" />;
  if (p.status === 'paid') return <Chip label="Pago" color="success" size="small" />;
  return <Chip label="Pendente" color="warning" size="small" />;
}

export function PayablesTable({ rows, onPay, onUnpay, onEdit }: PayablesTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {rows.map((p) => (
          <Card key={p.id} variant="outlined">
            <CardContent sx={{ pb: '12px !important' }}>
              <Typography variant="subtitle2">{p.description}</Typography>
              {p.category && <Typography variant="caption" color="text.secondary">{p.category}</Typography>}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2">R$ {p.amount}</Typography>
                <Typography variant="body2" color="text.secondary">{p.dueDate}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                <StatusChip p={p} />
                {p.paidAt && <Typography variant="caption" color="text.secondary">Pago em {p.paidAt}</Typography>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                {p.status === 'pending' && (
                  <Button size="small" variant="outlined" onClick={() => onPay(p)}>Dar baixa</Button>
                )}
                {p.status === 'paid' && (
                  <Button size="small" variant="outlined" color="warning" onClick={() => onUnpay(p)}>Estornar</Button>
                )}
                <Button size="small" variant="outlined" onClick={() => onEdit(p)}>Editar</Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Descrição</TableCell>
          <TableCell>Categoria</TableCell>
          <TableCell>Valor</TableCell>
          <TableCell>Vencimento</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Ações</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.description}</TableCell>
            <TableCell>{p.category ?? '—'}</TableCell>
            <TableCell>R$ {p.amount}</TableCell>
            <TableCell>{p.dueDate}</TableCell>
            <TableCell>
              <StatusChip p={p} />
              {p.paidAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {p.paidAt}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {p.status === 'pending' && (
                  <Button size="small" onClick={() => onPay(p)}>Baixa</Button>
                )}
                {p.status === 'paid' && (
                  <Button size="small" color="warning" onClick={() => onUnpay(p)}>Estornar</Button>
                )}
                <Button size="small" onClick={() => onEdit(p)}>Editar</Button>
              </Box>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
