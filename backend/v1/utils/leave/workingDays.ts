type DateInput = Date | string;

function toUTCDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function countWorkingDays(
  startDate: DateInput,
  endDate: DateInput,
  publicHolidays: DateInput[]
): number {
  const start = toUTCDate(startDate);
  const end = toUTCDate(endDate);

  const holidaySet = new Set(publicHolidays.map((h) => toUTCDate(h).getTime()));

  let count = 0;
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = holidaySet.has(d.getTime());
    if (!isWeekend && !isHoliday) count++;
  }

  return count;
}
