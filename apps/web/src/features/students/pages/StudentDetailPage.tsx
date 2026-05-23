import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStudent } from '../hooks/useStudent';
import { useArchiveStudent } from '../hooks/useStudentMutations';
import { useToast } from '../../../components/ToastProvider';

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

  const { data: student, isLoading } = useStudent(id ?? '');
  const archive = useArchiveStudent();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (!student) return null;

  const handleArchive = () => {
    archive.mutate(id!, {
      onSuccess: () => {
        showToast('Aluno arquivado', 'success');
        navigate('/students');
      },
      onError: () => showToast('Erro ao arquivar', 'error'),
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
        <Typography color="text.secondary">Nenhum atendimento registrado.</Typography>
      )}
    </Box>
  );
}
