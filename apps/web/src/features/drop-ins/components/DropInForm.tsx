import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import type { CreateDropInInput } from '@anna-maria/contracts';
import { useStudents } from '../../students/hooks/useStudents';

const chargeSchema = z
  .object({
    amount: z.string().regex(/^\d+\.\d{2}$/, 'Formato: 0.00'),
    dueDate: z.string().min(1, 'Data de vencimento obrigatória'),
    paymentMethod: z.enum(['cash', 'pix', 'card', 'boleto']).optional(),
    alreadyPaid: z.boolean(),
    paidAt: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.alreadyPaid && !v.paidAt) {
      ctx.addIssue({ code: 'custom', message: 'Data de pagamento obrigatória quando já paga', path: ['paidAt'] });
    }
  });

const schema = z
  .object({
    mode: z.enum(['student', 'prospect']),
    studentId: z.string().optional(),
    prospectName: z.string().optional(),
    scheduledAt: z.string().min(1, 'Data/hora obrigatória'),
    notes: z.string().optional(),
    addCharge: z.boolean(),
    charge: chargeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'student' && !v.studentId) {
      ctx.addIssue({ code: 'custom', message: 'Selecione um aluno', path: ['studentId'] });
    }
    if (v.mode === 'prospect' && (!v.prospectName || !v.prospectName.trim())) {
      ctx.addIssue({ code: 'custom', message: 'Nome do interessado obrigatório', path: ['prospectName'] });
    }
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  defaultScheduledAt?: string;
  onSubmit: (data: CreateDropInInput) => void;
  loading?: boolean;
}

export function DropInForm({ defaultScheduledAt, onSubmit, loading }: Props) {
  const { data: studentsResp } = useStudents({ isActive: true, pageSize: 100 });
  const students = studentsResp?.data ?? [];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      mode: 'prospect' as const,
      scheduledAt: defaultScheduledAt ?? '',
      addCharge: false,
      charge: { alreadyPaid: false },
    },
  });

  const mode = useWatch({ control, name: 'mode' });
  const addCharge = useWatch({ control, name: 'addCharge' });
  const alreadyPaid = useWatch({ control, name: 'charge.alreadyPaid' });

  const submit = (values: FormValues) => {
    const payload: CreateDropInInput = {
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      notes: values.notes || undefined,
      ...(values.mode === 'student' ? { studentId: values.studentId } : { prospectName: values.prospectName }),
    };

    if (values.addCharge && values.charge) {
      payload.charge = {
        amount: values.charge.amount,
        dueDate: values.charge.dueDate,
        paymentMethod: values.charge.paymentMethod,
        status: values.charge.alreadyPaid ? 'paid' : 'pending',
        paidAt: values.charge.alreadyPaid ? values.charge.paidAt : undefined,
      };
    }

    onSubmit(payload);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
      <Stack spacing={2}>
        <Controller
          name="mode"
          control={control}
          render={({ field }) => (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={field.value}
              onChange={(_, v) => v && field.onChange(v)}
            >
              <ToggleButton value="prospect">Interessado (prospect)</ToggleButton>
              <ToggleButton value="student">Aluno cadastrado</ToggleButton>
            </ToggleButtonGroup>
          )}
        />

        {mode === 'prospect' ? (
          <TextField
            label="Nome do interessado"
            required
            error={!!errors.prospectName}
            helperText={errors.prospectName?.message}
            {...register('prospectName')}
          />
        ) : (
          <Controller
            name="studentId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={students}
                getOptionLabel={(s) => s.fullName}
                value={students.find((s) => s.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Aluno"
                    required
                    error={!!errors.studentId}
                    helperText={errors.studentId?.message}
                  />
                )}
              />
            )}
          />
        )}

        <TextField
          label="Data e hora"
          type="datetime-local"
          required
          slotProps={{ inputLabel: { shrink: true } }}
          error={!!errors.scheduledAt}
          helperText={errors.scheduledAt?.message}
          {...register('scheduledAt')}
        />

        <TextField label="Observações" multiline rows={2} {...register('notes')} />

        <Divider />

        <Controller
          name="addCharge"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
              label="Cobrar agora"
            />
          )}
        />

        {addCharge && (
          <Stack spacing={2} sx={{ pl: 2, borderLeft: '3px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>Cobrança</Typography>

            <TextField
              label="Valor (ex: 60.00)"
              required
              error={!!errors.charge?.amount}
              helperText={errors.charge?.amount?.message}
              {...register('charge.amount')}
            />

            <TextField
              label="Vencimento"
              type="date"
              required
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.charge?.dueDate}
              helperText={errors.charge?.dueDate?.message}
              {...register('charge.dueDate')}
            />

            <FormControl size="small">
              <InputLabel>Forma de pagamento</InputLabel>
              <Controller
                name="charge.paymentMethod"
                control={control}
                render={({ field }) => (
                  <Select label="Forma de pagamento" value={field.value ?? ''} onChange={field.onChange}>
                    <MenuItem value="">Não informado</MenuItem>
                    <MenuItem value="cash">Dinheiro</MenuItem>
                    <MenuItem value="pix">Pix</MenuItem>
                    <MenuItem value="card">Cartão</MenuItem>
                    <MenuItem value="boleto">Boleto</MenuItem>
                  </Select>
                )}
              />
            </FormControl>

            <Controller
              name="charge.alreadyPaid"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Já paga"
                />
              )}
            />

            {alreadyPaid && (
              <TextField
                label="Data de pagamento"
                type="date"
                required
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.charge?.paidAt}
                helperText={(errors.charge?.paidAt as { message?: string } | undefined)?.message}
                {...register('charge.paidAt')}
              />
            )}
          </Stack>
        )}

        <Button type="submit" variant="contained" disabled={loading}>
          Registrar aula avulsa
        </Button>
      </Stack>
    </Box>
  );
}
