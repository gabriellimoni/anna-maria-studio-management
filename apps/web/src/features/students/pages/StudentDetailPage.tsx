import {
  Box,
  Button,
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
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Session, SessionStatus } from '@anna-maria/contracts';
import { useStudent } from '../hooks/useStudent';
import { useArchiveStudent } from '../hooks/useStudentMutations';
import { useSessions } from '../../schedule/hooks/useSessions';
import { AttendanceDialog } from '../../schedule/components/AttendanceDialog';
import { CancelSessionDialog } from '../../schedule/components/CancelSessionDialog';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const [tab, setTab] = useState(0);

  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [cancelSession, setCancelSession] = useState<Session | null>(null);

  const { data: student, isLoading } = useStudent(id ?? '');
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
    <Box sx={{ p: 3 }}>
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
        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <Field label="Telefone" value={student.phone} />
          <Field label="Email" value={student.email} />
          <Field label="Data de nascimento" value={student.birthDate} />
          <Field label="Observações" value={student.notes} />
        </Stack>
      )}

      {tab === 1 && (
        <Typography color="text.secondary">Nenhum plano contratado.</Typography>
      )}

      {tab === 2 && (
        sessionsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : !sessionsData?.data.length ? (
          <Typography color="text.secondary">Nenhum atendimento registrado.</Typography>
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
