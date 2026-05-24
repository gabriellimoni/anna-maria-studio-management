import { Box, Button, CircularProgress, Paper, TablePagination, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Payable } from '@anna-maria/contracts';
import { getApiError } from '../../../api/client';
import { useToast } from '../../../components/ToastProvider';
import { FinancialFiltersBar, type FinancialStatusFilter } from '../components/FinancialFiltersBar';
import { PayablesTable } from '../components/PayablesTable';
import { PayDialog } from '../components/PayDialog';
import { UnpayConfirmDialog } from '../components/UnpayConfirmDialog';
import { usePayables } from '../hooks/usePayables';
import { usePayPayable, useUnpayPayable } from '../hooks/usePayableMutations';

export function PayablesPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [status, setStatus] = useState<FinancialStatusFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [competenceMonth, setCompetenceMonth] = useState('');

  const [payTarget, setPayTarget] = useState<Payable | null>(null);
  const [unpayTarget, setUnpayTarget] = useState<Payable | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const query = {
    ...(status !== 'all' ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(competenceMonth ? { competenceMonth } : {}),
    page: page + 1,
    pageSize,
  };

  const { data, isLoading } = usePayables(query);
  const payMutation = usePayPayable();
  const unpayMutation = useUnpayPayable();

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const pending = rows.filter((p) => p.status === 'pending' && !p.isOverdue).length;
  const paid = rows.filter((p) => p.status === 'paid').length;
  const overdue = rows.filter((p) => p.isOverdue).length;

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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">A pagar</Typography>
        <Button variant="contained" onClick={() => navigate('/financeiro/pagar/novo')}>
          + Novo lançamento
        </Button>
      </Box>

      <FinancialFiltersBar
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(0); }}
        from={from}
        onFromChange={(v) => { setFrom(v); setPage(0); }}
        to={to}
        onToChange={(v) => { setTo(v); setPage(0); }}
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Mês de competência"
          type="month"
          size="small"
          value={competenceMonth}
          onChange={(e) => { setCompetenceMonth(e.target.value); setPage(0); }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 200 }}
        />
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">Nenhum lançamento encontrado.</Typography>
      ) : (
        <>
          <Paper variant="outlined" sx={{ overflow: 'auto' }}>
            <PayablesTable
              rows={rows}
              onPay={setPayTarget}
              onUnpay={setUnpayTarget}
              onEdit={(p) => navigate(`/financeiro/pagar/${p.id}/edit`)}
            />
          </Paper>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {total} lançamentos | Pendentes: {pending} | Pagas: {paid} | Atrasadas: {overdue}
            </Typography>
          </Box>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={pageSize}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Por página:"
          />
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
