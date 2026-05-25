import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useContractTemplate } from '../hooks/useContractTemplates';
import { useUpdateContractTemplate } from '../hooks/useContractTemplateMutations';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

export function ContractTemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();

  const { data: template, isLoading } = useContractTemplate(id!);
  const update = useUpdateContractTemplate(id!);

  const [markdown, setMarkdown] = useState(() => '');
  const [dirty, setDirty] = useState(false);

  const currentMarkdown = dirty ? markdown : (template?.bodyMarkdown ?? '');

  function handleSave() {
    update.mutate(
      { bodyMarkdown: currentMarkdown },
      {
        onSuccess: () => {
          setDirty(false);
          showToast('Template salvo', 'success');
        },
        onError: (e) => showToast(getApiError(e), 'error'),
      },
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!template) return null;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/contratos/templates')} size="small">
          Voltar
        </Button>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {template.name}
        </Typography>
        <Chip label={`v${template.version}`} size="small" />
        <Chip label={template.isActive ? 'Ativo' : 'Arquivado'} color={template.isActive ? 'success' : 'default'} size="small" />
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!dirty || update.isPending}
        >
          Salvar
        </Button>
      </Box>

      <MarkdownEditor
        value={currentMarkdown}
        onChange={(v) => {
          setMarkdown(v);
          setDirty(true);
        }}
        disabled={!template.isActive}
      />

      {!template.isActive && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Este template está arquivado e não pode ser editado.
        </Alert>
      )}
    </Box>
  );
}
