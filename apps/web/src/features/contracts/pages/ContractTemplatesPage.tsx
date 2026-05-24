import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContractTemplates } from '../hooks/useContractTemplates';
import { useArchiveContractTemplate, useCreateContractTemplate } from '../hooks/useContractTemplateMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

export function ContractTemplatesPage() {
  const { data: templates, isLoading } = useContractTemplates();
  const create = useCreateContractTemplate();
  const archive = useArchiveContractTemplate();
  const navigate = useNavigate();
  const showToast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');

  function handleCreate() {
    create.mutate(
      { name, bodyMarkdown: `# ${name}\n\nOlá {{studentName}},\n\n` },
      {
        onSuccess: (tpl) => {
          setCreateOpen(false);
          setName('');
          navigate(`/contratos/templates/${tpl.id}`);
        },
        onError: (e) => showToast(getApiError(e), 'error'),
      },
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Templates de contrato</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          Novo template
        </Button>
      </Box>

      {isLoading && <CircularProgress />}

      {!isLoading && templates?.length === 0 && (
        <Typography color="text.secondary">Nenhum template criado ainda.</Typography>
      )}

      {templates && templates.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Versão</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>v{t.version}</TableCell>
                <TableCell>
                  <Chip
                    label={t.isActive ? 'Ativo' : 'Arquivado'}
                    color={t.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell sx={{ textAlign: 'right' }}>
                  <IconButton size="small" onClick={() => navigate(`/contratos/templates/${t.id}`)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  {t.isActive && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() =>
                        archive.mutate(t.id, {
                          onError: (e) => showToast(getApiError(e), 'error'),
                        })
                      }
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Novo template</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!name.trim() || create.isPending} onClick={handleCreate}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
