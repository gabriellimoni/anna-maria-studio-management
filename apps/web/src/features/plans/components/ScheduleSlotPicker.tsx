import { Box, Chip, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { plansApi } from '../api/plans';

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

interface Props {
  index: number;
  weekday: number | '';
  startTime: string;
  from?: string;
  to?: string;
  onChange: (weekday: number | '', startTime: string) => void;
}

export function ScheduleSlotPicker({ index, weekday, startTime, from, to, onChange }: Props) {
  const [maxOccupied, setMaxOccupied] = useState<number | null>(null);

  useEffect(() => {
    if (weekday === '' || !startTime || !from || !to) return;

    let active = true;
    plansApi
      .checkCapacity({ weekday: weekday as number, startTime, from, to })
      .then((res) => {
        if (active) {
          const max = Math.max(0, ...res.slots.map((s) => s.occupied));
          setMaxOccupied(max);
        }
      })
      .catch(() => { if (active) setMaxOccupied(null); });
    return () => { active = false; };
  }, [weekday, startTime, from, to]);

  const isOverCapacity = weekday !== '' && startTime && maxOccupied !== null && maxOccupied >= 4;

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography sx={{ minWidth: 24, color: 'text.secondary' }}>{index + 1}.</Typography>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Dia</InputLabel>
        <Select
          label="Dia"
          value={weekday}
          onChange={(e) => onChange(e.target.value as number, startTime)}
        >
          {WEEKDAYS.map((d) => (
            <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="Horário"
        type="time"
        value={startTime}
        onChange={(e) => onChange(weekday, e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 130 }}
      />

      {isOverCapacity && (
        <Chip
          label={`Turma cheia (${maxOccupied}/4) — você pode prosseguir`}
          color="warning"
          size="small"
        />
      )}
    </Box>
  );
}
