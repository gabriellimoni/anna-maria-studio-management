import { Alert, Box, Button, Checkbox, CircularProgress, Container, FormControlLabel, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicContract } from '../hooks/usePublicContract';
import { useSignPublicContract } from '../hooks/useSignPublicContract';
import { ContractPreview } from '../components/ContractPreview';
import { SignatureCanvas } from '../components/SignatureCanvas';
import { publicContractsApi } from '../api/publicContracts';

export function PublicContractSignPage() {
  const { token } = useParams<{ token: string }>();
  const { data: contract, isLoading, error } = usePublicContract(token!);
  const sign = useSignPublicContract(token!);

  const [agreed, setAgreed] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  const isGone = status === 410;
  const isNotFound = status === 404;

  function handleSign() {
    if (!signatureImage) return;
    sign.mutate(
      { signatureImage },
      {
        onSuccess: () => setSigned(true),
      },
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          {contract?.studioName ?? 'Studio'}
        </Typography>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {isGone && (
        <Alert severity="warning">
          Este link expirou. Entre em contato com o estúdio para receber uma nova cópia.
        </Alert>
      )}

      {isNotFound && <Alert severity="error">Link inválido.</Alert>}

      {contract && !signed && contract.status === 'sent' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="h5" sx={{ textAlign: 'center' }}>
            Contrato para assinatura
          </Typography>

          <ContractPreview html={contract.renderedHtml} />

          <FormControlLabel
            control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
            label="Li e concordo com os termos acima"
          />

          <SignatureCanvas onConfirm={setSignatureImage} disabled={!agreed} />

          {sign.isError && (
            <Alert severity="error">
              {isAxiosError(sign.error)
                ? (sign.error.response?.data as { message?: string })?.message ?? 'Erro ao assinar'
                : 'Erro ao assinar'}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            disabled={!agreed || !signatureImage || sign.isPending}
            onClick={handleSign}
            sx={{ alignSelf: 'center', minWidth: 200 }}
          >
            {sign.isPending ? <CircularProgress size={20} /> : 'Assinar contrato'}
          </Button>
        </Box>
      )}

      {(signed || (contract && contract.status === 'signed')) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <Typography variant="h5" color="success.main">
            Contrato assinado!
          </Typography>
          {contract?.signedAt && (
            <Typography color="text.secondary">
              Assinado em {new Date(contract.signedAt).toLocaleDateString('pt-BR')} às{' '}
              {new Date(contract.signedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
          {(contract?.pdfAvailable || signed) && token && (
            <Button
              variant="contained"
              component="a"
              href={publicContractsApi.pdfUrl(token)}
              download
              target="_blank"
            >
              Baixar PDF
            </Button>
          )}
        </Box>
      )}
    </Container>
  );
}
