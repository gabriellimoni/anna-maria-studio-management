import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDropIns } from '../hooks/useDropIns';

const SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  present: 'Presente',
  absence_notified: 'Falta notificada',
  absence_unnotified: 'Falta',
  cancelled: 'Cancelada',
};

const CHARGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
};

export function DropInsListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { data: dropIns, isLoading } = useDropIns();
  const rows = dropIns ?? [];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Aulas avulsas</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/drop-ins/new')}>
          Nova aula avulsa
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
          Nenhuma aula avulsa registrada.
        </Typography>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rows.map((d) => (
            <Card key={d.id} variant="outlined">
              <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {d.studentName ?? d.prospectName ?? '—'}
                  {!d.studentId && (
                    <Chip label="Prospect" size="small" sx={{ ml: 1 }} />
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {format(new Date(d.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={SESSION_STATUS_LABELS[d.sessionStatus] ?? d.sessionStatus} size="small" />
                  {d.chargeStatus && (
                    <Chip
                      label={CHARGE_STATUS_LABELS[d.chargeStatus] ?? d.chargeStatus}
                      size="small"
                      color={d.chargeStatus === 'paid' ? 'success' : 'warning'}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data/Hora</TableCell>
                <TableCell>Aluno / Prospect</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Cobrança</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    {format(new Date(d.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {d.studentName ?? d.prospectName ?? '—'}
                    {!d.studentId && (
                      <Chip label="Prospect" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={SESSION_STATUS_LABELS[d.sessionStatus] ?? d.sessionStatus} size="small" />
                  </TableCell>
                  <TableCell>
                    {d.chargeStatus ? (
                      <Chip
                        label={CHARGE_STATUS_LABELS[d.chargeStatus] ?? d.chargeStatus}
                        size="small"
                        color={d.chargeStatus === 'paid' ? 'success' : 'warning'}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
