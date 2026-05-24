import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Receivable } from '@anna-maria/contracts';
import { getApiError } from '../../../api/client';
import { useToast } from '../../../components/ToastProvider';
import { FinancialFiltersBar, type FinancialStatusFilter, type InvoiceFilter } from '../components/FinancialFiltersBar';
import { PayDialog } from '../components/PayDialog';
import { ReceivablesTable } from '../components/ReceivablesTable';
import { UnpayConfirmDialog } from '../components/UnpayConfirmDialog';
import { useReceivables } from '../hooks/useReceivables';
import { useMarkInvoiced, usePayReceivable, useUnmarkInvoiced, useUnpayReceivable } from '../hooks/useReceivableMutations';

export function ReceivablesPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [status, setStatus] = useState<FinancialStatusFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');

  const [payTarget, setPayTarget] = useState<Receivable | null>(null);
  const [unpayTarget, setUnpayTarget] = useState<Receivable | null>(null);

  const query = {
    ...(status !== 'all' ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(invoiceFilter === 'invoiced' ? { invoiceGenerated: true } : {}),
    ...(invoiceFilter === 'not_invoiced' ? { invoiceGenerated: false } : {}),
  };

  const { data, isLoading } = useReceivables(query);
  const payMutation = usePayReceivable();
  const unpayMutation = useUnpayReceivable();
  const markInvoicedMutation = useMarkInvoiced();
  const unmarkInvoicedMutation = useUnmarkInvoiced();

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalAmount = data?.totalAmount ?? '0';

  const pending = rows.filter((r) => r.status === 'pending' && !r.isOverdue).length;
  const paid = rows.filter((r) => r.status === 'paid').length;
  const overdue = rows.filter((r) => r.isOverdue).length;

  const totalAmountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(totalAmount));

  function handlePay(paidAt: string, paymentMethod: Parameters<typeof payMutation.mutate>[0]['data']['paymentMethod']) {
    if (!payTarget) return;
    payMutation.mutate(
      { id: payTarget.id, data: { paidAt, paymentMethod } },
      {
        onSuccess: () => {
          showToast('Pagamento registrado', 'success');
          setPayTarget(null);
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao registrar pagamento'), 'error'),
      },
    );
  }

  function handleUnpay() {
    if (!unpayTarget) return;
    unpayMutation.mutate(unpayTarget.id, {
      onSuccess: () => {
        showToast('Pagamento estornado', 'success');
        setUnpayTarget(null);
      },
      onError: (err) => showToast(getApiError(err, 'Erro ao estornar pagamento'), 'error'),
    });
  }

  function handleMarkInvoiced(r: Receivable) {
    markInvoicedMutation.mutate(r.id, {
      onSuccess: () => showToast('NF marcada como emitida', 'success'),
      onError: (err) => showToast(getApiError(err, 'Erro ao marcar NF'), 'error'),
    });
  }

  function handleUnmarkInvoiced(r: Receivable) {
    unmarkInvoicedMutation.mutate(r.id, {
      onSuccess: () => showToast('NF desmarcada', 'success'),
      onError: (err) => showToast(getApiError(err, 'Erro ao desmarcar NF'), 'error'),
    });
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">A receber</Typography>
        <Button variant="contained" onClick={() => navigate('/financeiro/receber/novo')}>
          + Novo lançamento
        </Button>
      </Box>

      <FinancialFiltersBar
        status={status}
        onStatusChange={setStatus}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        invoiceFilter={invoiceFilter}
        onInvoiceFilterChange={setInvoiceFilter}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">Nenhum lançamento encontrado.</Typography>
      ) : (
        <>
          <Paper variant="outlined" sx={{ overflow: 'auto' }}>
            <ReceivablesTable
              rows={rows}
              onPay={setPayTarget}
              onUnpay={setUnpayTarget}
              onEdit={(r) => navigate(`/financeiro/receber/${r.id}/edit`)}
              onMarkInvoiced={handleMarkInvoiced}
              onUnmarkInvoiced={handleUnmarkInvoiced}
            />
          </Paper>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Total a receber: {totalAmountFormatted}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {total} lançamentos | Pendentes: {pending} | Pagas: {paid} | Atrasadas: {overdue}
            </Typography>
          </Box>
        </>
      )}

      <PayDialog
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={handlePay}
        loading={payMutation.isPending}
      />
      <UnpayConfirmDialog
        open={!!unpayTarget}
        onClose={() => setUnpayTarget(null)}
        onConfirm={handleUnpay}
        loading={unpayMutation.isPending}
      />
    </Box>
  );
}
