export interface ProrationInput {
  salary: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  joinDate?: string; // YYYY-MM-DD, clips the start of the window if within the period
  leaveDate?: string; // YYYY-MM-DD, clips the end of the window if within the period
  unpaidLeaveDays?: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function countWeekdays(start: string, end: string): number {
  let count = 0;
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (current <= last) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

export function calculateProration(input: ProrationInput): number {
  const { salary, periodStart, periodEnd, joinDate, leaveDate } = input;
  const unpaidLeaveDays = input.unpaidLeaveDays ?? 0;

  const totalWorkingDays = countWeekdays(periodStart, periodEnd);
  if (totalWorkingDays === 0) {
    return 0;
  }

  const windowStart = joinDate && joinDate > periodStart ? joinDate : periodStart;
  const windowEnd = leaveDate && leaveDate < periodEnd ? leaveDate : periodEnd;

  const daysPresent = windowStart <= windowEnd ? countWeekdays(windowStart, windowEnd) : 0;
  const daysToPay = Math.max(daysPresent - unpaidLeaveDays, 0);

  return round2((salary / totalWorkingDays) * daysToPay);
}
