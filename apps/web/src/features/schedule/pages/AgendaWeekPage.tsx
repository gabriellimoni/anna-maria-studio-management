import { Box, Button, CircularProgress, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Add, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useState } from 'react';
import { addDays, addWeeks, format, isSameDay, isWithinInterval, startOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Session } from '@anna-maria/contracts';
import { useNavigate } from 'react-router-dom';
import { useCalendar } from '../hooks/useCalendar';
import { WeekGrid } from '../components/WeekGrid';
import { DayList } from '../components/DayList';
import { AttendanceDialog } from '../components/AttendanceDialog';
import { CancelSessionDialog } from '../components/CancelSessionDialog';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function AgendaWeekPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const today = new Date();
    const ws = startOfWeek(today, { weekStartsOn: 1 });
    const we = addDays(ws, 6);
    return isWithinInterval(today, { start: ws, end: we }) ? today : ws;
  });
  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [cancelSession, setCancelSession] = useState<Session | null>(null);

  const from = format(weekStart, 'yyyy-MM-dd');
  const to = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data, isLoading } = useCalendar(from, to);

  const weekLabel = `${format(weekStart, 'dd/MM', { locale: ptBR })} – ${format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: ptBR })}`;

  const goToPrevWeek = () => {
    const newStart = subWeeks(weekStart, 1);
    setWeekStart(newStart);
    setSelectedDay(newStart);
  };
  const goToNextWeek = () => {
    const newStart = addWeeks(weekStart, 1);
    setWeekStart(newStart);
    setSelectedDay(newStart);
  };
  const goToToday = () => {
    const today = new Date();
    const ws = startOfWeek(today, { weekStartsOn: 1 });
    setWeekStart(ws);
    setSelectedDay(today);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>
          Agenda
        </Typography>
        <Button size="small" variant="contained" startIcon={<Add />} onClick={() => navigate('/drop-ins/new')}>
          Aula avulsa
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Button size="small" variant="outlined" onClick={goToToday}>
            Hoje
          </Button>
          <IconButton size="small" onClick={goToPrevWeek}>
            <ChevronLeft />
          </IconButton>
          {!isMobile && (
            <Typography sx={{ fontSize: 14, minWidth: 160, textAlign: 'center' }}>{weekLabel}</Typography>
          )}
          <IconButton size="small" onClick={goToNextWeek}>
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>

      {isMobile && (
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, overflowX: 'auto', pb: 0.5 }}>
          {days.map((day, i) => (
            <Button
              key={i}
              variant={isSameDay(day, selectedDay) ? 'contained' : 'text'}
              size="small"
              onClick={() => setSelectedDay(day)}
              sx={{ minWidth: 44, px: 0.5, flexDirection: 'column', gap: 0, lineHeight: 1 }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{DAY_LABELS[i]}</Typography>
              <Typography sx={{ fontSize: 11, lineHeight: 1.3 }}>{format(day, 'dd/MM')}</Typography>
            </Button>
          ))}
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : isMobile ? (
        <DayList
          date={format(selectedDay, 'yyyy-MM-dd')}
          slots={data?.slots ?? []}
          onAttendance={setAttendanceSession}
          onCancel={setCancelSession}
        />
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
