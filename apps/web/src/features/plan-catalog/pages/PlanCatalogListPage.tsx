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
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Archive, Edit } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { usePlanCatalog } from '../hooks/usePlanCatalog';
import { useArchivePlanCatalog } from '../hooks/usePlanCatalogMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export function PlanCatalogListPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { data: items, isLoading } = usePlanCatalog();
  const archive = useArchivePlanCatalog();

  const handleArchive = (id: string) => {
    archive.mutate(id, {
      onSuccess: () => showToast('Item desativado', 'success'),
      onError: (err) => showToast(getApiError(err, 'Erro ao desativar'), 'error'),
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Catálogo de planos</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/plan-catalog/new')}>
          Novo plano
        </Button>
      </Box>

      <Paper variant="outlined">
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Frequência</TableCell>
                <TableCell>Preço base</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(items ?? []).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{PERIOD_LABELS[item.period] ?? item.period}</TableCell>
                  <TableCell>{item.weeklyFrequency}x/semana</TableCell>
                  <TableCell>R$ {item.basePrice}</TableCell>
                  <TableCell>
                    <Chip
                      label={item.isActive ? 'Ativo' : 'Inativo'}
                      size="small"
                      color={item.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => navigate(`/plan-catalog/${item.id}/edit`)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Desativar">
                      <IconButton size="small" onClick={() => handleArchive(item.id)} disabled={!item.isActive}>
                        <Archive fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
