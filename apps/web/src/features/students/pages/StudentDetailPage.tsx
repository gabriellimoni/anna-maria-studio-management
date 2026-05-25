import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add, Edit, Visibility } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PlanStatus, Session, SessionStatus } from '@anna-maria/contracts';
import { useStudent } from '../hooks/useStudent';
import { useArchiveStudent } from '../hooks/useStudentMutations';
import { useSessions } from '../../schedule/hooks/useSessions';
import { usePlans } from '../../plans/hooks/usePlans';
import { AttendanceDialog } from '../../schedule/components/AttendanceDialog';
import { CancelSessionDialog } from '../../schedule/components/CancelSessionDialog';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

const PLAN_STATUS_LABELS: Record<PlanStatus, { label: string; color: 'success' | 'default' | 'error' }> = {
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

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Agendado',
  present: 'Presente',
  absence_notified: 'Falta justificada',
  absence_unnotified: 'Falta',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<SessionStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  scheduled: 'primary',
  present: 'success',
  absence_notified: 'warning',
  absence_unnotified: 'error',
  cancelled: 'default',
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography>{value ?? '—'}</Typography>
    </Box>
  );
}

export function StudentDetailPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const [tab, setTab] = useState(0);

  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [cancelSession, setCancelSession] = useState<Session | null>(null);

  const { data: student, isLoading } = useStudent(id ?? '');
  const { data: plansData, isLoading: plansLoading } = usePlans(
    tab === 1 ? { studentId: id, pageSize: 100 } : undefined,
  );
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions(
    tab === 2 ? { studentId: id, pageSize: 100 } : undefined,
  );
  const archive = useArchiveStudent();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (!student) return null;

  const handleArchive = () => {
    archive.mutate(id!, {
      onSuccess: () => {
        showToast('Aluno arquivado', 'success');
        navigate('/students');
      },
      onError: (err) => showToast(getApiError(err, 'Erro ao arquivar'), 'error'),
    });
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{student.fullName}</Typography>
          <Chip
            label={student.isActive ? 'Ativo' : 'Inativo'}
            size="small"
            color={student.isActive ? 'success' : 'default'}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Edit />} variant="outlined" onClick={() => navigate(`/students/${id}/edit`)}>
            Editar
          </Button>
          {student.isActive && (
            <Button color="error" variant="outlined" onClick={handleArchive} disabled={archive.isPending}>
              Arquivar
            </Button>
          )}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Dados" />
        <Tab label="Planos" />
        <Tab label="Atendimentos" />
      </Tabs>
      <Divider sx={{ mb: 3 }} />

      {tab === 0 && (
        <Stack spacing={3} sx={{ maxWidth: 560 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>Contato</Typography>
            <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 4 } }}>
              <Field label="Telefone" value={student.phone} />
              <Field label="Email" value={student.email} />
            </Stack>
            <Field label="Data de nascimento" value={student.birthDate} />
            <Field label="Observações" value={student.notes} />
          </Stack>

          <Divider />

          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>Documentos</Typography>
            <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 4 } }}>
              <Field label="CPF" value={student.cpf} />
              <Field label="RG" value={student.rg} />
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>Endereço</Typography>
            <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 4 } }}>
              <Field label="Logradouro" value={student.addressStreet} />
              <Field label="Número" value={student.addressNumber} />
            </Stack>
            <Field label="Complemento" value={student.addressComplement} />
            <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 4 } }}>
              <Field label="Cidade" value={student.addressCity} />
              <Field label="Estado" value={student.addressState} />
              <Field label="CEP" value={student.addressZipcode} />
            </Stack>
          </Stack>
        </Stack>
      )}

      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate(`/plans/new?studentId=${id}`)}
            >
              Novo plano
            </Button>
          </Box>
          {plansLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : !plansData?.data.length ? (
            <Typography color="text.secondary">Nenhum plano contratado.</Typography>
          ) : isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {plansData.data.map((plan) => {
                const st = PLAN_STATUS_LABELS[plan.status] ?? { label: plan.status, color: 'default' as const };
                return (
                  <Card key={plan.id} variant="outlined">
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{PERIOD_LABELS[plan.period] ?? plan.period} · {plan.weeklyFrequency}x/sem</Typography>
                          <Typography variant="body2" color="text.secondary">{plan.startDate} → {plan.endDate}</Typography>
                          <Typography variant="body2">R$ {plan.totalPrice}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <Chip label={st.label} color={st.color} size="small" />
                          <Button size="small" startIcon={<Visibility />} onClick={() => navigate(`/plans/${plan.id}`)}>Ver</Button>
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
                  <TableCell>Período</TableCell>
                  <TableCell>Frequência</TableCell>
                  <TableCell>Validade</TableCell>
                  <TableCell>Valor total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {plansData.data.map((plan) => {
                  const st = PLAN_STATUS_LABELS[plan.status] ?? { label: plan.status, color: 'default' as const };
                  return (
                    <TableRow key={plan.id} hover>
                      <TableCell>{PERIOD_LABELS[plan.period] ?? plan.period}</TableCell>
                      <TableCell>{plan.weeklyFrequency}x/semana</TableCell>
                      <TableCell>{plan.startDate} → {plan.endDate}</TableCell>
                      <TableCell>R$ {plan.totalPrice}</TableCell>
                      <TableCell>
                        <Chip label={st.label} color={st.color} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => navigate(`/plans/${plan.id}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Box>
      )}

      {tab === 2 && (
        sessionsLoading ? (
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
                        <Chip label={STATUS_LABELS[session.status]} color={STATUS_COLORS[session.status]} size="small" />
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
                        label={STATUS_LABELS[session.status]}
                        color={STATUS_COLORS[session.status]}
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
        )
      )}

      <AttendanceDialog
        open={!!attendanceSession}
        session={attendanceSession}
        onClose={() => setAttendanceSession(null)}
      />
      <CancelSessionDialog
        open={!!cancelSession}
        session={cancelSession}
        onClose={() => setCancelSession(null)}
      />
    </Box>
  );
}
