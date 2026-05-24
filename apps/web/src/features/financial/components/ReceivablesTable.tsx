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
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { Receivable } from '@anna-maria/contracts';

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

function ReceivableDescription({ r }: { r: Receivable }) {
  if (r.studentName && r.planPeriod && r.planWeeklyFrequency != null) {
    return (
      <>
        <Typography variant="body2">{r.studentName}</Typography>
        <Typography variant="caption" color="text.secondary">
          {PERIOD_LABELS[r.planPeriod] ?? r.planPeriod} · {r.planWeeklyFrequency}x/semana
        </Typography>
      </>
    );
  }
  return <Typography variant="body2">{r.description}</Typography>;
}

interface ReceivablesTableProps {
  rows: Receivable[];
  onPay: (r: Receivable) => void;
  onUnpay: (r: Receivable) => void;
  onEdit: (r: Receivable) => void;
  onMarkInvoiced: (r: Receivable) => void;
  onUnmarkInvoiced: (r: Receivable) => void;
}

function StatusChip({ r }: { r: Receivable }) {
  if (r.isOverdue) return <Chip label="ATRASADA" color="error" size="small" />;
  if (r.status === 'paid') return <Chip label="Pago" color="success" size="small" />;
  return <Chip label="Pendente" color="warning" size="small" />;
}

function InvoiceChip({ invoiceGenerated }: { invoiceGenerated: boolean }) {
  if (invoiceGenerated) return <Chip label="NF emitida" color="info" size="small" variant="outlined" />;
  return <Chip label="Sem NF" size="small" variant="outlined" />;
}

export function ReceivablesTable({ rows, onPay, onUnpay, onEdit, onMarkInvoiced, onUnmarkInvoiced }: ReceivablesTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {rows.map((r) => (
          <Card key={r.id} variant="outlined">
            <CardContent sx={{ pb: '12px !important' }}>
              <ReceivableDescription r={r} />
              {r.installmentNumber && r.installmentTotal && (
                <Typography variant="caption" color="text.secondary">
                  Parcela {r.installmentNumber}/{r.installmentTotal}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2">R$ {r.amount}</Typography>
                <Typography variant="body2" color="text.secondary">{r.dueDate}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusChip r={r} />
                <InvoiceChip invoiceGenerated={r.invoiceGenerated} />
                {r.paidAt && <Typography variant="caption" color="text.secondary">Pago em {r.paidAt}</Typography>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                {r.status === 'pending' && (
                  <Button size="small" variant="outlined" onClick={() => onPay(r)}>Dar baixa</Button>
                )}
                {r.status === 'paid' && (
                  <Button size="small" variant="outlined" color="warning" onClick={() => onUnpay(r)}>Estornar</Button>
                )}
                {!r.invoiceGenerated && (
                  <Button size="small" variant="outlined" color="info" onClick={() => onMarkInvoiced(r)}>Marcar NF</Button>
                )}
                {r.invoiceGenerated && (
                  <Button size="small" variant="outlined" onClick={() => onUnmarkInvoiced(r)}>Desmarcar NF</Button>
                )}
                <Button size="small" variant="outlined" onClick={() => onEdit(r)}>Editar</Button>
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
          <TableCell>Vínculo</TableCell>
          <TableCell>Parcela</TableCell>
          <TableCell>Valor</TableCell>
          <TableCell>Vencimento</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>NF</TableCell>
          <TableCell>Ações</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell><ReceivableDescription r={r} /></TableCell>
            <TableCell>
              {r.planId ? (
                <Link to={`/plans/${r.planId}`} style={{ color: 'inherit' }}>
                  Ver plano
                </Link>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell>
              {r.installmentNumber && r.installmentTotal
                ? `${r.installmentNumber}/${r.installmentTotal}`
                : '—'}
            </TableCell>
            <TableCell>R$ {r.amount}</TableCell>
            <TableCell>{r.dueDate}</TableCell>
            <TableCell>
              <StatusChip r={r} />
              {r.paidAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {r.paidAt}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <InvoiceChip invoiceGenerated={r.invoiceGenerated} />
            </TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {r.status === 'pending' && (
                  <Button size="small" onClick={() => onPay(r)}>Baixa</Button>
                )}
                {r.status === 'paid' && (
                  <Button size="small" color="warning" onClick={() => onUnpay(r)}>Estornar</Button>
                )}
                {!r.invoiceGenerated ? (
                  <Tooltip title="Marcar NF como emitida">
                    <Button size="small" color="info" onClick={() => onMarkInvoiced(r)}>NF</Button>
                  </Tooltip>
                ) : (
                  <Tooltip title="Desmarcar NF">
                    <Button size="small" onClick={() => onUnmarkInvoiced(r)}>-NF</Button>
                  </Tooltip>
                )}
                <Button size="small" onClick={() => onEdit(r)}>Editar</Button>
              </Box>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
