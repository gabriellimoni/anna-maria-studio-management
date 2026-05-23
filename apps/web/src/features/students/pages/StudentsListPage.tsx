import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudents } from '../hooks/useStudents';
import { useArchiveStudent } from '../hooks/useStudentMutations';
import { StudentsTable } from '../components/StudentsTable';
import { useToast } from '../../../components/ToastProvider';

export function StudentsListPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'true' | 'false' | undefined>('true');

  const { data, isLoading } = useStudents({
    search: search || undefined,
    isActive: activeFilter !== undefined ? activeFilter === 'true' : undefined,
    pageSize: 50,
  });

  const archive = useArchiveStudent();

  const handleArchive = (id: string) => {
    archive.mutate(id, {
      onSuccess: () => showToast('Aluno arquivado', 'success'),
      onError: () => showToast('Erro ao arquivar', 'error'),
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Alunos</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/students/new')}>
          Novo aluno
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
          sx={{ width: 280 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={activeFilter}
          onChange={(_, v) => setActiveFilter(v)}
        >
          <ToggleButton value="true">Ativos</ToggleButton>
          <ToggleButton value="false">Inativos</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper variant="outlined">
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <StudentsTable students={data?.data ?? []} onArchive={handleArchive} />
        )}
      </Paper>
    </Box>
  );
}
