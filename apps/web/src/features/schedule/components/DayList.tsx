import { Box, Chip, Typography } from '@mui/material';
import { Warning } from '@mui/icons-material';
import type { CalendarSlot, Session } from '@anna-maria/contracts';
import { SlotCard } from './SlotCard';

interface Props {
  date: string;
  slots: CalendarSlot[];
  onAttendance: (session: Session) => void;
  onCancel: (session: Session) => void;
}

export function DayList({ date, slots, onAttendance, onCancel }: Props) {
  const daySlots = slots
    .filter((s) => s.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (!daySlots.length) {
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        Nenhuma aula neste dia.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {daySlots.map((slot) => (
        <Box key={`${slot.date}|${slot.startTime}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{slot.startTime}</Typography>
            <Chip
              label={`${slot.occupied}/${slot.capacity}`}
              size="small"
              color={slot.isOverCapacity ? 'warning' : 'default'}
              icon={slot.isOverCapacity ? <Warning /> : undefined}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {slot.sessions.map((session) => (
              <SlotCard
                key={session.id}
                session={session}
                onAttendance={onAttendance}
                onCancel={onCancel}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
