import {
  Box,
  Button,
  Card,
  CardContent,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PlanStatus, Receivable, SessionStatus } from '@anna-maria/contracts';
import { usePlan } from '../hooks/usePlan';
import { useCancelPlan, useFinishPlan } from '../hooks/usePlanMutations';
import { useSessions } from '../../schedule/hooks/useSessions';
import { AttendanceDialog } from '../../schedule/components/AttendanceDialog';
import type { Session } from '@anna-maria/contracts';
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

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Agendado',
  present: 'Presente',
  absence_notified: 'Falta justificada',
  absence_unnotified: 'Falta',
  cancelled: 'Cancelado',
};

const SESSION_STATUS_COLORS: Record<SessionStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  scheduled: 'primary',
  present: 'success',
  absence_notified: 'warning',
  absence_unnotified: 'error',
  cancelled: 'default',
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export function PlanDetailPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const [tab, setTab] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFutureSessions, setCancelFutureSessions] = useState(true);
  const [finishOpen, setFinishOpen] = useState(false);

  const { data: plan, isLoading } = usePlan(id ?? '');
  const cancelPlan = useCancelPlan(id ?? '');
  const finishPlan = useFinishPlan(id ?? '');
  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);

  const { data: sessionsData, isLoading: sessionsLoading } = useSessions(
    tab === 0 && id ? { planId: id, pageSize: 200 } : undefined,
  );
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

  const handleFinish = () => {
    finishPlan.mutate(undefined, {
      onSuccess: () => {
        showToast('Plano encerrado', 'success');
        setFinishOpen(false);
      },
      onError: (err) => showToast(getApiError(err, 'Erro ao encerrar plano'), 'error'),
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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" size="small" onClick={() => navigate(`/plans/${id}/change-schedule`)}>
              Trocar horário
            </Button>
            <Button variant="outlined" size="small" onClick={() => setFinishOpen(true)}>
              Encerrar plano
            </Button>
            <Button color="error" variant="outlined" size="small" onClick={() => setCancelOpen(true)}>
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
        {plan.schedules.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">Horários</Typography>
            {plan.schedules.map((s) => (
              <Typography key={s.id}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.weekday]} — {s.startTime.slice(0, 5)}
              </Typography>
            ))}
          </Box>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 0 }}>
        <Tab label="Atendimentos" />
        <Tab label="Parcelas" />
        <Tab label="Contrato" />
      </Tabs>
      <Divider sx={{ mb: 3 }} />

      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total</Typography>
              <Typography>{plan.summary.totalSessions}</Typography>
            </Box>
            {Object.entries(plan.summary.sessionsByStatus).map(([status, count]) => (
              <Box key={status}>
                <Typography variant="caption" color="text.secondary">
                  {SESSION_STATUS_LABELS[status as SessionStatus] ?? status}
                </Typography>
                <Typography>{count}</Typography>
              </Box>
            ))}
          </Box>
          {sessionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : !sessionsData?.data.length ? (
            <Typography color="text.secondary">Nenhum atendimento registrado.</Typography>
          ) : isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {sessionsData.data.map((session) => {
                const dt = new Date(session.scheduledAt);
                return (
                  <Card key={session.id} variant="outlined">
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>
                            {dt.toLocaleDateString('pt-BR')} · {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                          {session.notes && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{session.notes}</Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <Chip label={SESSION_STATUS_LABELS[session.status]} color={SESSION_STATUS_COLORS[session.status]} size="small" />
                          {session.status !== 'cancelled' && (
                            <Button size="small" onClick={() => setAttendanceSession(session)}>Editar</Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Horário</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Observações</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sessionsData.data.map((session) => {
                  const dt = new Date(session.scheduledAt);
                  return (
                    <TableRow key={session.id}>
                      <TableCell>{dt.toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell>
                        <Chip
                          label={SESSION_STATUS_LABELS[session.status]}
                          color={SESSION_STATUS_COLORS[session.status]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {session.notes ?? '—'}
                      </TableCell>
                      <TableCell align="right">
                        {session.status !== 'cancelled' && (
                          <Button size="small" onClick={() => setAttendanceSession(session)}>
                            Editar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <AttendanceDialog
            open={!!attendanceSession}
            session={attendanceSession}
            onClose={() => setAttendanceSession(null)}
          />
        </Box>
      )}

      {tab === 1 && (
        <>
          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {planReceivables.map((r, i) => {
                const today = new Date().toISOString().slice(0, 10);
                const isOverdue = r.status === 'pending' && r.dueDate < today;
                return (
                  <Card key={r.id} variant="outlined">
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>#{r.installmentNumber ?? i + 1} · R$ {r.amount}</Typography>
                          <Typography variant="body2" color="text.secondary">Venc. {r.dueDate}</Typography>
                          {r.paidAt && <Typography variant="body2" color="text.secondary">Pago em {r.paidAt}</Typography>}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          {isOverdue ? (
                            <Chip label="ATRASADA" color="error" size="small" />
                          ) : (
                            <Chip
                              label={r.status === 'paid' ? 'Pago' : 'Pendente'}
                              color={r.status === 'paid' ? 'success' : 'warning'}
                              size="small"
                            />
                          )}
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {r.status === 'pending' && (
                              <Button size="small" onClick={() => setPayTarget(r)}>Baixa</Button>
                            )}
                            {r.status === 'paid' && (
                              <Button size="small" color="warning" onClick={() => setUnpayTarget(r)}>Estornar</Button>
                            )}
                            <Button size="small" onClick={() => navigate(`/financeiro/receber/${r.id}/edit`)}>Editar</Button>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          ) : (
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
          )}

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

      {tab === 2 && id && <PlanContractSection planId={id} />}

      <Dialog open={finishOpen} onClose={() => setFinishOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Encerrar plano</DialogTitle>
        <DialogContent>
          <Typography sx={{ pt: 1 }}>
            Tem certeza que deseja encerrar este plano? Parcelas e atendimentos não serão alterados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinishOpen(false)}>Cancelar</Button>
          <Button onClick={handleFinish} disabled={finishPlan.isPending}>
            {finishPlan.isPending ? <CircularProgress size={20} /> : 'Encerrar'}
          </Button>
        </DialogActions>
      </Dialog>

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
