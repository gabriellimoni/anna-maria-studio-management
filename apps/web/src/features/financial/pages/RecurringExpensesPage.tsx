import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecurringExpense } from '@anna-maria/contracts';
import { getApiError } from '../../../api/client';
import { useToast } from '../../../components/ToastProvider';
import { RunGenerationDialog } from '../components/RunGenerationDialog';
import { useDeleteRecurringExpense } from '../hooks/useRecurringExpenseMutations';
import { useRecurringExpenses } from '../hooks/useRecurringExpenses';

export function RecurringExpensesPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [runDialogOpen, setRunDialogOpen] = useState(false);

  const query =
    activeFilter === 'active'
      ? { isActive: true }
      : activeFilter === 'inactive'
        ? { isActive: false }
        : {};

  const { data, isLoading } = useRecurringExpenses(query);
  const deleteMutation = useDeleteRecurringExpense();

  const rows: RecurringExpense[] = data?.data ?? [];

  function handleDelete(rule: RecurringExpense) {
    if (!window.confirm(`Excluir despesa recorrente "${rule.description}"?`)) return;
    deleteMutation.mutate(rule.id, {
      onSuccess: () => showToast('Despesa recorrente excluída', 'success'),
      onError: (err) => showToast(getApiError(err, 'Erro ao excluir'), 'error'),
    });
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Despesas recorrentes</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => setRunDialogOpen(true)}>
            Gerar lançamentos
          </Button>
          <Button variant="contained" onClick={() => navigate('/financeiro/despesas-recorrentes/novo')}>
            + Nova regra
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          value={activeFilter}
          exclusive
          onChange={(_, v) => v && setActiveFilter(v)}
        >
          <ToggleButton value="all">Todas</ToggleButton>
          <ToggleButton value="active">Ativas</ToggleButton>
          <ToggleButton value="inactive">Inativas</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">Nenhuma despesa recorrente encontrada.</Typography>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Descrição</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Valor esperado</TableCell>
                <TableCell>Dia venc.</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>{rule.description}</TableCell>
                  <TableCell>{rule.category ?? '—'}</TableCell>
                  <TableCell>
                    {Number(rule.expectedAmount).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </TableCell>
                  <TableCell>Dia {rule.dueDay}</TableCell>
                  <TableCell>
                    <Chip
                      label={rule.isActive ? 'Ativa' : 'Inativa'}
                      size="small"
                      color={rule.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/financeiro/despesas-recorrentes/${rule.id}/edit`)}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDelete(rule)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <RunGenerationDialog open={runDialogOpen} onClose={() => setRunDialogOpen(false)} />
    </Box>
  );
}
