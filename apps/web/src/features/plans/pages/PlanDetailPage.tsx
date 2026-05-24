import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PlanStatus, Receivable } from '@anna-maria/contracts';
import { usePlan } from '../hooks/usePlan';
import { useCancelPlan } from '../hooks/usePlanMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';
import { useReceivables } from '../../financial/hooks/useReceivables';
import { usePayReceivable, useUnpayReceivable } from '../../financial/hooks/useReceivableMutations';
import { PayDialog } from '../../financial/components/PayDialog';
import { UnpayConfirmDialog } from '../../financial/components/UnpayConfirmDialog';
import { PlanContractSection } from '../../contracts/components/PlanContractSection';

const STATUS_LABELS: Record<PlanStatus, { label: string; color: 'success' | 'default' | 'error' }> = {
  active: { label: 'Ativo', color: 'success' },
  finished: { label: 'Encerrado', color: 'default' },
  cancelled: { label: 'Cancelado', color: 'error' },
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const [tab, setTab] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFutureSessions, setCancelFutureSessions] = useState(true);

  const { data: plan, isLoading } = usePlan(id ?? '');
  const cancelPlan = useCancelPlan(id ?? '');

  const { data: receivablesData } = useReceivables(id ? { planId: id } : undefined);
  const payReceivable = usePayReceivable();
  const unpayReceivable = useUnpayReceivable();
  const [payTarget, setPayTarget] = useState<Receivable | null>(null);
  const [unpayTarget, setUnpayTarget] = useState<Receivable | null>(null);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (!plan) return null;

  const st = STATUS_LABELS[plan.status] ?? { label: plan.status, color: 'default' };
  const planReceivables = receivablesData?.data ?? [];

  const handlePay = (paidAt: string, paymentMethod: Receivable['paymentMethod'] & string) => {
    if (!payTarget) return;
    payReceivable.mutate(
      { id: payTarget.id, data: { paidAt, paymentMethod: paymentMethod as Parameters<typeof payReceivable.mutate>[0]['data']['paymentMethod'] } },
      {
        onSuccess: () => {
          showToast('Pagamento registrado', 'success');
          setPayTarget(null);
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao registrar pagamento'), 'error'),
      },
    );
  };

  const handleUnpay = () => {
    if (!unpayTarget) return;
    unpayReceivable.mutate(unpayTarget.id, {
      onSuccess: () => {
        showToast('Pagamento estornado', 'success');
        setUnpayTarget(null);
      },
      onError: (err) => showToast(getApiError(err, 'Erro ao estornar pagamento'), 'error'),
    });
  };

  const handleCancel = () => {
    cancelPlan.mutate(
      { reason: cancelReason || undefined, cancelFutureSessions },
      {
        onSuccess: (res) => {
          const msg = `${res.cancelledFutureSessions} aulas canceladas. ${res.pendingReceivables.length} parcelas pendentes — gerencie em Financeiro.`;
          showToast(msg, 'success');
          setCancelOpen(false);
        },
        onError: (err) => showToast(getApiError(err, 'Erro ao cancelar plano'), 'error'),
      },
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Plano</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip label={st.label} color={st.color} size="small" />
            <Chip label={PERIOD_LABELS[plan.period] ?? plan.period} size="small" variant="outlined" />
            <Chip label={`${plan.weeklyFrequency}x/semana`} size="small" variant="outlined" />
          </Box>
        </Box>
        {plan.status === 'active' && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => navigate(`/plans/${id}/change-schedule`)}>
              Trocar horário
            </Button>
            <Button color="error" variant="outlined" onClick={() => setCancelOpen(true)}>
              Cancelar
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, my: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Início</Typography>
          <Typography>{plan.startDate}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Fim</Typography>
          <Typography>{plan.endDate}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Total</Typography>
          <Typography>R$ {plan.totalPrice}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Parcelas</Typography>
          <Typography>{plan.installmentsCount}</Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 0 }}>
        <Tab label="Horários" />
        <Tab label="Atendimentos" />
        <Tab label="Parcelas" />
        <Tab label="Contrato" />
      </Tabs>
      <Divider sx={{ mb: 3 }} />

      {tab === 0 && (
        <Box>
          {plan.schedules.map((s) => (
            <Box key={s.id} sx={{ mb: 1 }}>
              <Typography>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.weekday]} — {s.startTime}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total</Typography>
              <Typography>{plan.summary.totalSessions}</Typography>
            </Box>
            {Object.entries(plan.summary.sessionsByStatus).map(([status, count]) => (
              <Box key={status}>
                <Typography variant="caption" color="text.secondary">{status}</Typography>
                <Typography>{count}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {tab === 2 && (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pago em</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {planReceivables.map((r, i) => {
                const today = new Date().toISOString().slice(0, 10);
                const isOverdue = r.status === 'pending' && r.dueDate < today;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.installmentNumber ?? i + 1}</TableCell>
                    <TableCell>R$ {r.amount}</TableCell>
                    <TableCell>{r.dueDate}</TableCell>
                    <TableCell>
                      {isOverdue ? (
                        <Chip label="ATRASADA" color="error" size="small" />
                      ) : (
                        <Chip
                          label={r.status === 'paid' ? 'Pago' : 'Pendente'}
                          color={r.status === 'paid' ? 'success' : 'warning'}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>{r.paidAt ?? '—'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {r.status === 'pending' && (
                          <Button size="small" onClick={() => setPayTarget(r)}>Baixa</Button>
                        )}
                        {r.status === 'paid' && (
                          <Button size="small" color="warning" onClick={() => setUnpayTarget(r)}>Estornar</Button>
                        )}
                        <Button size="small" onClick={() => navigate(`/financeiro/receber/${r.id}/edit`)}>Editar</Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <PayDialog
            open={!!payTarget}
            onClose={() => setPayTarget(null)}
            onConfirm={handlePay}
            loading={payReceivable.isPending}
          />
          <UnpayConfirmDialog
            open={!!unpayTarget}
            onClose={() => setUnpayTarget(null)}
            onConfirm={handleUnpay}
            loading={unpayReceivable.isPending}
          />
        </>
      )}

      {tab === 3 && id && <PlanContractSection planId={id} />}

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancelar plano</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Motivo (opcional)"
              multiline
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={cancelFutureSessions}
                  onChange={(e) => setCancelFutureSessions(e.target.checked)}
                />
              }
              label="Cancelar aulas futuras"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Fechar</Button>
          <Button color="error" onClick={handleCancel} disabled={cancelPlan.isPending}>
            {cancelPlan.isPending ? <CircularProgress size={20} /> : 'Cancelar plano'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
