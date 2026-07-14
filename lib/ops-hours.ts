export type MonthlyHoursSummary = {
  monthHours: number;
  monthOvertimeHours: number;
  hoursRemaining: number;
  overtimeTriggered: boolean;
  baseEarningsZar: number;
  overtimeEarningsZar: number;
  totalEarningsZar: number;
};

export function computeMonthlyHoursSummary(input: {
  monthHours: number;
  monthlyHourCap: number;
  baseMonthlyPayZar: number;
  overtimeRateZar: number;
}): MonthlyHoursSummary {
  const monthHours = Math.max(0, input.monthHours);
  const cap = input.monthlyHourCap;
  const monthOvertimeHours = Math.max(0, monthHours - cap);
  const hoursRemaining = Math.max(0, cap - monthHours);
  const overtimeTriggered = monthHours > cap;
  const baseEarningsZar = Number(input.baseMonthlyPayZar);
  const overtimeEarningsZar = monthOvertimeHours * Number(input.overtimeRateZar);

  return {
    monthHours,
    monthOvertimeHours,
    hoursRemaining,
    overtimeTriggered,
    baseEarningsZar,
    overtimeEarningsZar,
    totalEarningsZar: baseEarningsZar + overtimeEarningsZar,
  };
}

export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function monthEndUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
