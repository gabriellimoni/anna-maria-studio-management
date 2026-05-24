import { Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { PlanCatalogForm, type PlanCatalogFormValues } from '../components/PlanCatalogForm';
import { usePlanCatalogItem } from '../hooks/usePlanCatalog';
import { useCreatePlanCatalog, useUpdatePlanCatalog } from '../hooks/usePlanCatalogMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

export function PlanCatalogFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const isEdit = !!id;

  const { data: item, isLoading } = usePlanCatalogItem(id ?? '');
  const create = useCreatePlanCatalog();
  const update = useUpdatePlanCatalog(id ?? '');

  const handleSubmit = (values: PlanCatalogFormValues) => {
    const action = isEdit ? update.mutateAsync(values) : create.mutateAsync(values);

    action
      .then(() => {
        showToast(isEdit ? 'Plano atualizado' : 'Plano criado', 'success');
        navigate('/plan-catalog');
      })
      .catch((err) => showToast(getApiError(err, 'Erro ao salvar'), 'error'));
  };

  if (isEdit && isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        {isEdit ? 'Editar plano' : 'Novo plano'}
      </Typography>
      <PlanCatalogForm
        defaultValues={item}
        onSubmit={handleSubmit}
        loading={create.isPending || update.isPending}
      />
    </Box>
  );
}
