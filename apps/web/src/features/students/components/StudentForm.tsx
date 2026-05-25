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
  cpf: z.string().optional(),
  rg: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZipcode: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof schema>;

function stripEmpty(values: StudentFormValues): StudentFormValues {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === '' ? undefined : v]),
  ) as StudentFormValues;
}

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
      cpf: defaultValues?.cpf ?? '',
      rg: defaultValues?.rg ?? '',
      addressStreet: defaultValues?.addressStreet ?? '',
      addressNumber: defaultValues?.addressNumber ?? '',
      addressComplement: defaultValues?.addressComplement ?? '',
      addressCity: defaultValues?.addressCity ?? '',
      addressState: defaultValues?.addressState ?? '',
      addressZipcode: defaultValues?.addressZipcode ?? '',
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit((v) => onSubmit(stripEmpty(v)))} noValidate>
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
        <Stack sx={{ flexDirection: 'row', gap: 2 }}>
          <TextField label="CPF" sx={{ flex: 1 }} {...register('cpf')} />
          <TextField label="RG" sx={{ flex: 1 }} {...register('rg')} />
        </Stack>
        <Stack sx={{ flexDirection: 'row', gap: 2 }}>
          <TextField label="Logradouro" sx={{ flex: 1 }} {...register('addressStreet')} />
          <TextField label="Número" sx={{ width: 120 }} {...register('addressNumber')} />
        </Stack>
        <TextField label="Complemento" {...register('addressComplement')} />
        <Stack sx={{ flexDirection: 'row', gap: 2 }}>
          <TextField label="Cidade" sx={{ flex: 1 }} {...register('addressCity')} />
          <TextField label="Estado (UF)" sx={{ width: 120 }} {...register('addressState')} />
          <TextField label="CEP" sx={{ width: 140 }} {...register('addressZipcode')} />
        </Stack>
        <Button type="submit" variant="contained" disabled={loading}>
          Salvar
        </Button>
      </Stack>
    </Box>
  );
}
