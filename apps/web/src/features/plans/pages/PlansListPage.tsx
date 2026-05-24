import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ListPlansQuery, PlanStatus } from '@anna-maria/contracts';
import { usePlans } from '../hooks/usePlans';
import { ExpiryFilterChips } from '../components/ExpiryFilterChips';

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

export function PlansListPage() {
  const navigate = useNavigate();
  const [expiringInDays, setExpiringInDays] = useState<7 | 30 | 60 | 90 | undefined>();
  const [status, setStatus] = useState<PlanStatus | ''>('');

  const query: ListPlansQuery = {
    expiringInDays,
    status: status || undefined,
    pageSize: 50,
  };

  const { data, isLoading } = usePlans(query);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Planos</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/plans/new')}>
          Novo plano
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <ExpiryFilterChips value={expiringInDays} onChange={setExpiringInDays} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as PlanStatus | '')}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="active">Ativo</MenuItem>
            <MenuItem value="finished">Encerrado</MenuItem>
            <MenuItem value="cancelled">Cancelado</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Paper variant="outlined">
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Aluno</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Frequência</TableCell>
                <TableCell>Validade</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 2 }}>Nenhum plano encontrado</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (data?.data ?? []).map((plan) => {
                  const st = STATUS_LABELS[plan.status] ?? { label: plan.status, color: 'default' };
                  return (
                    <TableRow key={plan.id} hover>
                      <TableCell>{plan.studentName}</TableCell>
                      <TableCell>{PERIOD_LABELS[plan.period] ?? plan.period}</TableCell>
                      <TableCell>{plan.weeklyFrequency}x/semana</TableCell>
                      <TableCell>{plan.endDate}</TableCell>
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
                })
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
