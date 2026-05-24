import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useState } from 'react';
import { addDays, addWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Session } from '@anna-maria/contracts';
import { useCalendar } from '../hooks/useCalendar';
import { WeekGrid } from '../components/WeekGrid';
import { AttendanceDialog } from '../components/AttendanceDialog';
import { CancelSessionDialog } from '../components/CancelSessionDialog';

export function AgendaWeekPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [cancelSession, setCancelSession] = useState<Session | null>(null);

  const from = format(weekStart, 'yyyy-MM-dd');
  const to = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data, isLoading } = useCalendar(from, to);

  const weekLabel = `${format(weekStart, 'dd/MM', { locale: ptBR })} – ${format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: ptBR })}`;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>
          Agenda
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Hoje
        </Button>
        <IconButton onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
          <ChevronLeft />
        </IconButton>
        <Typography sx={{ fontSize: 14, minWidth: 160, textAlign: 'center' }}>{weekLabel}</Typography>
        <IconButton onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight />
        </IconButton>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <WeekGrid
          weekStart={weekStart}
          slots={data?.slots ?? []}
          onAttendance={setAttendanceSession}
          onCancel={setCancelSession}
        />
      )}

      <AttendanceDialog
        open={!!attendanceSession}
        session={attendanceSession}
        onClose={() => setAttendanceSession(null)}
      />
      <CancelSessionDialog
        open={!!cancelSession}
        session={cancelSession}
        onClose={() => setCancelSession(null)}
      />
    </Box>
  );
}
