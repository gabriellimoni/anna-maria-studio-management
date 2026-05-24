import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreatePlanInput, InstallmentInput } from '@anna-maria/contracts';
import { useStudents } from '../../students/hooks/useStudents';
import { usePlanCatalog } from '../../plan-catalog/hooks/usePlanCatalog';
import { useCreatePlan } from '../hooks/usePlanMutations';
import { ScheduleSlotPicker } from '../components/ScheduleSlotPicker';
import { InstallmentsEditor } from '../components/InstallmentsEditor';
import { useToast } from '../../../components/ToastProvider';
import { getApiError } from '../../../api/client';
import { suggestInstallments } from '../utils/installments-suggester';

const STEPS = ['Dados básicos', 'Horários', 'Parcelas'];

interface ScheduleSlot {
  weekday: number | '';
  startTime: string;
}

export function PlanCreateWizardPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [activeStep, setActiveStep] = useState(0);

  const [studentId, setStudentId] = useState<string>('');
  const [catalogId, setCatalogId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [installments, setInstallments] = useState<InstallmentInput[]>([]);

  const { data: studentsData } = useStudents({ pageSize: 100 });
  const { data: catalogsData } = usePlanCatalog({ isActive: true });
  const createPlan = useCreatePlan();

  const students = studentsData?.data ?? [];
  const catalogs = catalogsData ?? [];
  const selectedCatalog = catalogs.find((c) => c.id === catalogId);
  const weeklyFrequency = selectedCatalog?.weeklyFrequency ?? 0;

  const handleCatalogSelect = (id: string) => {
    setCatalogId(id);
    const cat = catalogs.find((c) => c.id === id);
    if (cat) {
      setTotalPrice(cat.basePrice);
      const freq = cat.weeklyFrequency;
      setSchedules(Array.from({ length: freq }, () => ({ weekday: '' as const, startTime: '' })));
    }
  };

  const validSchedules = schedules.every((s) => s.weekday !== '' && s.startTime);
  const installmentSum = installments.reduce((s, i) => s + parseFloat(i.amount || '0'), 0);
  const sumCloses = Math.abs(installmentSum - parseFloat(totalPrice || '0')) <= 0.01;

  const handleNext = () => {
    if (activeStep === 0 && selectedCatalog && !installments.length) {
      setInstallments(
        suggestInstallments(totalPrice, selectedCatalog.durationMonths, startDate || new Date().toISOString().slice(0, 10), 'monthly'),
      );
    }
    setActiveStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const dto: CreatePlanInput = {
      studentId,
      planCatalogId: catalogId,
      startDate,
      totalPrice,
      schedules: schedules.map((s) => ({ weekday: s.weekday as number, startTime: s.startTime })),
      installments,
      notes: notes || undefined,
    };

    createPlan.mutate(dto, {
      onSuccess: (res) => {
        showToast('Plano criado com sucesso', 'success');
        navigate(`/plans/${res.id}`);
      },
      onError: (err) => showToast(getApiError(err, 'Erro ao criar plano'), 'error'),
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Novo plano</Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              options={students}
              getOptionLabel={(s) => s.fullName}
              value={students.find((s) => s.id === studentId) ?? null}
              onChange={(_, v) => setStudentId(v?.id ?? '')}
              renderInput={(params) => <TextField {...params} label="Aluno" size="small" required />}
            />
            <Autocomplete
              options={catalogs}
              getOptionLabel={(c) => `${c.name} — R$ ${c.basePrice}`}
              value={catalogs.find((c) => c.id === catalogId) ?? null}
              onChange={(_, v) => { if (v) handleCatalogSelect(v.id); else setCatalogId(''); }}
              renderInput={(params) => <TextField {...params} label="Catálogo" size="small" required />}
            />
            <TextField
              size="small"
              label="Início"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              label="Valor total (R$)"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              required
            />
            <TextField
              size="small"
              label="Observações"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
            />
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!studentId || !catalogId || !startDate || !totalPrice}
            >
              Próximo
            </Button>
          </Box>
        </Paper>
      )}

      {activeStep === 1 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Selecione {weeklyFrequency} horário(s) por semana
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {schedules.map((slot, i) => (
              <ScheduleSlotPicker
                key={i}
                index={i}
                weekday={slot.weekday}
                startTime={slot.startTime}
                from={startDate}
                to={startDate}
                onChange={(wd, st) => {
                  const next = schedules.map((s, idx) => idx === i ? { weekday: wd, startTime: st } : s);
                  setSchedules(next);
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
            <Button onClick={() => setActiveStep(0)}>Voltar</Button>
            <Button variant="contained" onClick={handleNext} disabled={!validSchedules}>
              Próximo
            </Button>
          </Box>
        </Paper>
      )}

      {activeStep === 2 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>Parcelas</Typography>
          {installments.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Clique em "Sugerir" para gerar parcelas automaticamente.
            </Alert>
          )}
          <InstallmentsEditor
            value={installments}
            totalPrice={totalPrice}
            onChange={setInstallments}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
            <Button onClick={() => setActiveStep(1)}>Voltar</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!sumCloses || createPlan.isPending || installments.length === 0}
            >
              {createPlan.isPending ? <CircularProgress size={20} /> : 'Criar plano'}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
