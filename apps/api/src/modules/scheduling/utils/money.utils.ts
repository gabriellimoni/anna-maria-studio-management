/** Sums numeric(10,2) string values using integer cents to avoid float drift. */
export function sumDecimals(values: string[]): string {
  const totalCents = values.reduce((acc, v) => acc + Math.round(parseFloat(v) * 100), 0);
  return (totalCents / 100).toFixed(2);
}

/** Compares two numeric(10,2) strings with a tolerance of N cents (default 1). */
export function decimalsEqual(a: string, b: string, toleranceCents = 1): boolean {
  const diff = Math.abs(Math.round(parseFloat(a) * 100) - Math.round(parseFloat(b) * 100));
  return diff <= toleranceCents;
}
