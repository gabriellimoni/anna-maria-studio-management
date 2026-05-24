import { Box, Chip, Typography } from '@mui/material';
import { Warning } from '@mui/icons-material';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarSlot, Session } from '@anna-maria/contracts';
import { SlotCard } from './SlotCard';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface Props {
  weekStart: Date;
  slots: CalendarSlot[];
  onAttendance: (session: Session) => void;
  onCancel: (session: Session) => void;
}

export function WeekGrid({ weekStart, slots, onAttendance, onCancel }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayKeys = days.map((d) => format(d, 'yyyy-MM-dd'));

  const allTimes = [...new Set(slots.map((s) => s.startTime))].sort();

  const slotIndex = new Map<string, CalendarSlot>();
  for (const slot of slots) {
    slotIndex.set(`${slot.date}|${slot.startTime}`, slot);
  }

  if (!allTimes.length) {
    return (
      <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
        Nenhuma aula nesta semana.
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(7, minmax(120px, 1fr))`,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          minWidth: 600,
        }}
      >
        {/* Header row */}
        <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }} />
        {days.map((day, i) => (
          <Box
            key={dayKeys[i]}
            sx={{
              p: 1,
              borderLeft: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{DAY_LABELS[i]}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {format(day, 'dd/MM', { locale: ptBR })}
            </Typography>
          </Box>
        ))}

        {/* Time rows */}
        {allTimes.map((time) => (
          <>
            <Box
              key={`time-${time}`}
              sx={{
                p: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'flex-start',
                pt: 1.5,
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>{time}</Typography>
            </Box>
            {dayKeys.map((dayKey) => {
              const slot = slotIndex.get(`${dayKey}|${time}`);
              return (
                <Box
                  key={`${dayKey}|${time}`}
                  sx={{
                    p: 0.75,
                    borderLeft: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    ...(slot?.isOverCapacity && { borderLeft: '3px solid', borderLeftColor: 'warning.main' }),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    minHeight: 60,
                  }}
                >
                  {slot && (
                    <>
                      {slot.isOverCapacity && (
                        <Chip
                          icon={<Warning />}
                          label={`${slot.occupied}/${slot.capacity}`}
                          size="small"
                          color="warning"
                          sx={{ fontSize: 10, height: 18, alignSelf: 'flex-start' }}
                        />
                      )}
                      {slot.sessions.map((session) => (
                        <SlotCard
                          key={session.id}
                          session={session}
                          onAttendance={onAttendance}
                          onCancel={onCancel}
                        />
                      ))}
                    </>
                  )}
                </Box>
              );
            })}
          </>
        ))}
      </Box>
    </Box>
  );
}
