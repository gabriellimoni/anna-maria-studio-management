import type { InstallmentInput } from '@anna-maria/contracts';
import { addMonths, addWeeks, format, parseISO } from 'date-fns';

export function suggestInstallments(
  totalPrice: string,
  count: number,
  firstDueDate: string,
  periodicity: 'monthly' | 'weekly',
): InstallmentInput[] {
  if (count < 1) return [];

  const totalCents = Math.round(parseFloat(totalPrice) * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;

  const installments: InstallmentInput[] = [];
  const firstDate = parseISO(firstDueDate);

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amountCents = baseCents + (isLast ? remainder : 0);
    const amount = (amountCents / 100).toFixed(2);

    const dueDate =
      periodicity === 'monthly'
        ? format(addMonths(firstDate, i), 'yyyy-MM-dd')
        : format(addWeeks(firstDate, i), 'yyyy-MM-dd');

    installments.push({ amount, dueDate });
  }

  return installments;
}
