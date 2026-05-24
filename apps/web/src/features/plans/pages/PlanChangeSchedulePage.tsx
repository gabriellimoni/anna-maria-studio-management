import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PlanDetail } from '../api/plans';
import { usePlan } from '../hooks/usePlan';
import { useChangeSchedule } from '../hooks/usePlanMutations';
import { ScheduleSlotPicker } from '../components/ScheduleSlotPicker';
import { useToast } from '../../../components/ToastProvider';

interface ScheduleSlot {
  weekday: number | '';
  startTime: string;
}

function ChangeScheduleForm({ plan }: { plan: PlanDetail }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const changeSchedule = useChangeSchedule(plan.id);

  const [schedules, setSchedules] = useState<ScheduleSlot[]>(
    plan.schedules.map((s) => ({ weekday: s.weekday, startTime: s.startTime })),
  );

  const validSchedules = schedules.every((s) => s.weekday !== '' && s.startTime);

  const handleSubmit = () => {
    changeSchedule.mutate(
      { schedules: schedules.map((s) => ({ weekday: s.weekday as number, startTime: s.startTime })) },
      {
        onSuccess: (res) => {
          showToast(
            `${res.createdSessions} aulas criadas, ${res.removedFutureSessions} removidas`,
            'success',
          );
          navigate(`/plans/${plan.id}`);
        },
        onError: () => showToast('Erro ao trocar horário', 'error'),
      },
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography sx={{ mb: 2, color: 'text.secondary' }}>
        {plan.weeklyFrequency}x/semana · {plan.period}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {schedules.map((slot, i) => (
          <ScheduleSlotPicker
            key={i}
            index={i}
            weekday={slot.weekday}
            startTime={slot.startTime}
            from={new Date().toISOString().slice(0, 10)}
            to={plan.endDate}
            onChange={(wd, st) => {
              setSchedules((prev) => prev.map((s, idx) => (idx === i ? { weekday: wd, startTime: st } : s)));
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
        <Button onClick={() => navigate(`/plans/${plan.id}`)}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!validSchedules || changeSchedule.isPending}
        >
          {changeSchedule.isPending ? <CircularProgress size={20} /> : 'Salvar'}
        </Button>
      </Box>
    </Paper>
  );
}

export function PlanChangeSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading } = usePlan(id ?? '');

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (!plan) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Trocar horário</Typography>
      <ChangeScheduleForm plan={plan} />
    </Box>
  );
}
