import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import { useContractTemplates } from '../hooks/useContractTemplates';
import { usePlanContract } from '../hooks/usePlanContract';
import {
  useCancelContract,
  useMaterializeContract,
  useSendContract,
  useUpdateDraftContract,
} from '../hooks/usePlanContractMutations';
import { ContractStatusBadge } from './ContractStatusBadge';
import { MarkdownEditor } from './MarkdownEditor';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';
import { planContractsApi } from '../api/planContracts';

interface Props {
  planId: string;
}

export function PlanContractSection({ planId }: Props) {
  const { data: contract, isLoading, error } = usePlanContract(planId);
  const { data: templates } = useContractTemplates({ isActive: true });
  const showToast = useToast();

  const [materializeOpen, setMaterializeOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [markdownDirty, setMarkdownDirty] = useState(false);

  const materialize = useMaterializeContract(planId);
  const updateDraft = useUpdateDraftContract(planId);
  const send = useSendContract(planId);

  const is404 = (error as { response?: { status?: number } } | null)?.response?.status === 404;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!contract || is404) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nenhum contrato gerado para este plano.
        </Typography>
        <Button variant="contained" onClick={() => setMaterializeOpen(true)}>
          Gerar contrato
        </Button>

        <Dialog open={materializeOpen} onClose={() => setMaterializeOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Selecionar template</DialogTitle>
          <DialogContent>
            <Select
              fullWidth
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              displayEmpty
              sx={{ mt: 1 }}
            >
              <MenuItem value="" disabled>
                Selecione um template...
              </MenuItem>
              {templates?.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} (v{t.version})
                </MenuItem>
              ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMaterializeOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              disabled={!selectedTemplateId || materialize.isPending}
              onClick={() =>
                materialize.mutate(
                  { templateId: selectedTemplateId },
                  {
                    onSuccess: () => setMaterializeOpen(false),
                    onError: (e) => showToast(getApiError(e), 'error'),
                  },
                )
              }
            >
              Gerar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  if (contract.status === 'draft') {
    const currentMarkdown = markdownDirty ? markdown : contract.bodyMarkdown;

    return (
      <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContractStatusBadge status={contract.status} />
          <Typography variant="body2" color="text.secondary">
            Edite o markdown e envie para assinatura.
          </Typography>
        </Box>

        <MarkdownEditor
          value={markdownDirty ? markdown : contract.bodyMarkdown}
          onChange={(v) => {
            setMarkdown(v);
            setMarkdownDirty(true);
          }}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {markdownDirty && (
            <Button
              variant="outlined"
              disabled={updateDraft.isPending}
              onClick={() =>
                updateDraft.mutate(
                  { bodyMarkdown: currentMarkdown },
                  {
                    onSuccess: () => {
                      setMarkdownDirty(false);
                      showToast('Salvo', 'success');
                    },
                    onError: (e) => showToast(getApiError(e), 'error'),
                  },
                )
              }
            >
              Salvar rascunho
            </Button>
          )}
          <Button variant="contained" color="primary" onClick={() => setSendOpen(true)}>
            Enviar para assinatura
          </Button>
          <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)}>
            Cancelar
          </Button>
        </Box>

        <Dialog open={sendOpen} onClose={() => setSendOpen(false)}>
          <DialogTitle>Enviar para assinatura</DialogTitle>
          <DialogContent>
            <Typography>
              O contrato será gerado com os dados atuais do plano e ficará disponível via link público. Continuar?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSendOpen(false)}>Voltar</Button>
            <Button
              variant="contained"
              disabled={send.isPending}
              onClick={() =>
                send.mutate(undefined, {
                  onSuccess: (data) => {
                    setSendOpen(false);
                    navigator.clipboard.writeText(data.publicUrl).catch(() => {});
                    showToast('Link copiado para a área de transferência!', 'success');
                  },
                  onError: (e) => {
                    setSendOpen(false);
                    showToast(getApiError(e), 'error');
                  },
                })
              }
            >
              Enviar
            </Button>
          </DialogActions>
        </Dialog>

        <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} planId={planId} />
      </Box>
    );
  }

  if (contract.status === 'sent') {
    const publicUrl = contract.publicUrl ?? '';
    return (
      <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContractStatusBadge status={contract.status} />
          <Typography variant="body2" color="text.secondary">
            Aguardando assinatura do aluno.
          </Typography>
        </Box>

        {publicUrl && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {publicUrl}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl).catch(() => {});
                showToast('Link copiado!', 'success');
              }}
            >
              Copiar link
            </Button>
          </Box>
        )}

        <Box>
          <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)}>
            Cancelar e refazer
          </Button>
        </Box>

        <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} planId={planId} />
      </Box>
    );
  }

  if (contract.status === 'signed') {
    return (
      <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContractStatusBadge status={contract.status} />
          <Typography variant="body2">
            Assinado em {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('pt-BR') : '—'}
          </Typography>
        </Box>

        <Box>
          <Button
            variant="contained"
            onClick={() => planContractsApi.downloadPdf(planId)}
          >
            Baixar PDF
          </Button>
        </Box>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">Evidências de assinatura</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {contract.signerIp && (
                <Typography variant="caption">
                  <strong>IP:</strong> {contract.signerIp}
                </Typography>
              )}
              {contract.signerGeoCity && (
                <Typography variant="caption">
                  <strong>Local:</strong> {contract.signerGeoCity}
                  {contract.signerGeoRegion ? `, ${contract.signerGeoRegion}` : ''}
                </Typography>
              )}
              {contract.signerUserAgent && (
                <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                  <strong>Dispositivo:</strong> {contract.signerUserAgent.slice(0, 120)}
                </Typography>
              )}
              {contract.contentHash && (
                <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                  <strong>Hash SHA-256:</strong> {contract.contentHash}
                </Typography>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  }

  // cancelled
  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ContractStatusBadge status={contract.status} />
        <Typography variant="body2" color="text.secondary">
          Cancelado em {contract.cancelledAt ? new Date(contract.cancelledAt).toLocaleDateString('pt-BR') : '—'}
        </Typography>
      </Box>
      <Box>
        <Button variant="contained" onClick={() => setMaterializeOpen(true)}>
          Gerar novo contrato
        </Button>
      </Box>
      <Dialog open={materializeOpen} onClose={() => setMaterializeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Selecionar template</DialogTitle>
        <DialogContent>
          <Select
            fullWidth
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            displayEmpty
            sx={{ mt: 1 }}
          >
            <MenuItem value="" disabled>
              Selecione um template...
            </MenuItem>
            {templates?.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} (v{t.version})
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaterializeOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!selectedTemplateId || materialize.isPending}
            onClick={() =>
              materialize.mutate(
                { templateId: selectedTemplateId },
                {
                  onSuccess: () => setMaterializeOpen(false),
                  onError: (e) => showToast(getApiError(e), 'error'),
                },
              )
            }
          >
            Gerar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CancelDialog({ open, onClose, planId }: { open: boolean; onClose: () => void; planId: string }) {
  const cancel = useCancelContract(planId);
  const showToast = useToast();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Cancelar contrato</DialogTitle>
      <DialogContent>
        <Typography>Tem certeza? O link atual ficará inativo. Um novo contrato pode ser gerado.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Voltar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate(undefined, {
              onSuccess: () => {
                onClose();
                showToast('Contrato cancelado', 'success');
              },
              onError: (e) => showToast(getApiError(e), 'error'),
            })
          }
        >
          Cancelar contrato
        </Button>
      </DialogActions>
    </Dialog>
  );
}
