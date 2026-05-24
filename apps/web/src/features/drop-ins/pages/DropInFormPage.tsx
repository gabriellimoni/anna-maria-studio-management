import { Alert, Box, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CreateDropInInput, CreateDropInResponse } from '@anna-maria/contracts';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';
import { useCreateDropIn } from '../hooks/useDropInMutations';
import { DropInForm } from '../components/DropInForm';

export function DropInFormPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [searchParams] = useSearchParams();
  const [overCapacityWarning, setOverCapacityWarning] = useState<{ occupied: number } | null>(null);

  const defaultScheduledAt = searchParams.get('scheduledAt') ?? '';

  const create = useCreateDropIn();

  const handleSubmit = (data: CreateDropInInput) => {
    create.mutate(data, {
      onSuccess: (result: CreateDropInResponse) => {
        if (result.warnings?.overCapacity) {
          setOverCapacityWarning({ occupied: result.warnings.occupied });
        }
        showToast('Aula avulsa registrada', 'success');
        navigate('/drop-ins');
      },
      onError: (err) => showToast(getApiError(err, 'Erro ao registrar aula avulsa'), 'error'),
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 560 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Nova aula avulsa
      </Typography>

      {overCapacityWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Turma cheia: {overCapacityWarning.occupied} alunos já neste horário. A aula avulsa foi registrada mesmo assim.
        </Alert>
      )}

      <DropInForm
        defaultScheduledAt={defaultScheduledAt}
        onSubmit={handleSubmit}
        loading={create.isPending}
      />
    </Box>
  );
}
