import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useState } from 'react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import type { Session } from '@anna-maria/contracts';
import { useCalendar } from '../hooks/useCalendar';
import { DayList } from '../components/DayList';
import { AttendanceDialog } from '../components/AttendanceDialog';
import { CancelSessionDialog } from '../components/CancelSessionDialog';

export function AgendaDayPage() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const date = dateParam ?? format(new Date(), 'yyyy-MM-dd');

  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [cancelSession, setCancelSession] = useState<Session | null>(null);

  const { data, isLoading } = useCalendar(date, date);

  const goToDate = (d: Date) => navigate(`/agenda/dia/${format(d, 'yyyy-MM-dd')}`);

  const parsedDate = parseISO(date);
  const dateLabel = format(parsedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => goToDate(subDays(parsedDate, 1))}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700, flex: 1, textTransform: 'capitalize' }}>
          {dateLabel}
        </Typography>
        <IconButton onClick={() => goToDate(addDays(parsedDate, 1))}>
          <ChevronRight />
        </IconButton>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <DayList
          date={date}
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
