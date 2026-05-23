import { addDays, getDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const TZ = 'America/Sao_Paulo';

/**
 * Iterates every day in [from, to] inclusive (interpreted in America/Sao_Paulo)
 * and returns only dates where getDay() matches the given weekday (0=Sun…6=Sat).
 */
export function iterateDatesMatchingWeekday(from: Date, to: Date, weekday: number): Date[] {
  const results: Date[] = [];
  let current = toZonedTime(from, TZ);
  const end = toZonedTime(to, TZ);

  while (current <= end) {
    if (getDay(current) === weekday) {
      results.push(current);
    }
    current = addDays(current, 1);
  }
  return results;
}

/**
 * Composes a scheduledAt timestamp from a zoned date (Y-M-D from DB 'date' column)
 * and a start time string 'HH:mm', treating both as America/Sao_Paulo.
 * Returns a UTC Date.
 */
export function composeScheduledAt(date: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(':').map(Number);
  const zoned = toZonedTime(date, TZ);
  zoned.setHours(hours, minutes, 0, 0);
  return fromZonedTime(zoned, TZ);
}

/** Parses a 'YYYY-MM-DD' string as midnight in America/Sao_Paulo, returns UTC Date. */
export function parseDateBR(dateStr: string): Date {
  return fromZonedTime(new Date(`${dateStr}T00:00:00`), TZ);
}
