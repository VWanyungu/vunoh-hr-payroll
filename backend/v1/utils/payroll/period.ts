export function getPeriodBounds(periodMonth: number, periodYear: number) {
  const periodStart = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0))
    .toISOString()
    .slice(0, 10);
  return { periodStart, periodEnd };
}
