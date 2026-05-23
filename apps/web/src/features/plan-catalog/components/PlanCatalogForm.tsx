import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import type { PlanCatalog } from '@anna-maria/contracts';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  period: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
  weeklyFrequency: z.number().int().min(1).max(7),
  basePrice: z.string().regex(/^\d+\.\d{2}$/, 'Formato: 000.00'),
});

export type PlanCatalogFormValues = z.infer<typeof schema>;

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

interface Props {
  defaultValues?: Partial<PlanCatalog>;
  onSubmit: (values: PlanCatalogFormValues) => void;
  loading?: boolean;
}

export function PlanCatalogForm({ defaultValues, onSubmit, loading }: Props) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<PlanCatalogFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      period: defaultValues?.period ?? 'monthly',
      weeklyFrequency: defaultValues?.weeklyFrequency ?? 2,
      basePrice: defaultValues?.basePrice ?? '',
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        <TextField
          label="Nome"
          required
          error={!!errors.name}
          helperText={errors.name?.message}
          {...register('name')}
        />

        <Controller
          name="period"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.period} required>
              <InputLabel>Período</InputLabel>
              <Select label="Período" {...field}>
                {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
              {errors.period && <FormHelperText>{errors.period.message}</FormHelperText>}
            </FormControl>
          )}
        />

        <Controller
          name="weeklyFrequency"
          control={control}
          render={({ field }) => (
            <FormControl error={!!errors.weeklyFrequency} required>
              <InputLabel>Frequência semanal</InputLabel>
              <Select label="Frequência semanal" {...field}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <MenuItem key={n} value={n}>{n}x por semana</MenuItem>
                ))}
              </Select>
              {errors.weeklyFrequency && <FormHelperText>{errors.weeklyFrequency.message}</FormHelperText>}
            </FormControl>
          )}
        />

        <TextField
          label="Preço base (R$)"
          required
          placeholder="280.00"
          error={!!errors.basePrice}
          helperText={errors.basePrice?.message ?? 'Formato: 280.00'}
          {...register('basePrice')}
        />

        <Button type="submit" variant="contained" disabled={loading}>
          Salvar
        </Button>
      </Stack>
    </Box>
  );
}
