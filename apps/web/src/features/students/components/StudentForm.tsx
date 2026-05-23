import { Box, Button, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import type { Student } from '@anna-maria/contracts';

const schema = z.object({
  fullName: z.string().min(1, 'Nome obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Student>;
  onSubmit: (values: StudentFormValues) => void;
  loading?: boolean;
}

export function StudentForm({ defaultValues, onSubmit, loading }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<StudentFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      birthDate: defaultValues?.birthDate ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        <TextField
          label="Nome completo"
          required
          error={!!errors.fullName}
          helperText={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField label="Telefone" {...register('phone')} />
        <TextField
          label="Email"
          type="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField label="Data de nascimento" type="date" slotProps={{ inputLabel: { shrink: true } }} {...register('birthDate')} />
        <TextField label="Observações" multiline rows={3} {...register('notes')} />
        <Button type="submit" variant="contained" disabled={loading}>
          Salvar
        </Button>
      </Stack>
    </Box>
  );
}
