import { Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { StudentForm, type StudentFormValues } from '../components/StudentForm';
import { useStudent } from '../hooks/useStudent';
import { useCreateStudent, useUpdateStudent } from '../hooks/useStudentMutations';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';

export function StudentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const isEdit = !!id;

  const { data: student, isLoading } = useStudent(id ?? '');
  const create = useCreateStudent();
  const update = useUpdateStudent(id ?? '');

  const handleSubmit = (values: StudentFormValues) => {
    const action = isEdit
      ? update.mutateAsync(values)
      : create.mutateAsync(values);

    action
      .then((result) => {
        showToast(isEdit ? 'Aluno atualizado' : 'Aluno criado', 'success');
        navigate(`/students/${isEdit ? id : (result as { id: string }).id}`);
      })
      .catch((err) => showToast(getApiError(err, 'Erro ao salvar'), 'error'));
  };

  if (isEdit && isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 560 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        {isEdit ? 'Editar aluno' : 'Novo aluno'}
      </Typography>
      <StudentForm
        defaultValues={student}
        onSubmit={handleSubmit}
        loading={create.isPending || update.isPending}
      />
    </Box>
  );
}
