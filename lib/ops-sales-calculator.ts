/** Cost-saving tier range offered during sales (matches commercial pricing tiers). */
export const SALES_CALCULATOR_TIER_MIN = 25;
export const SALES_CALCULATOR_TIER_MAX = 40;
export const SALES_CALCULATOR_TIER_DEFAULT = 25;

/** BLOCHARCH monthly fee = benchmark × (1 − saving%). */
export function blocharchMonthlyFeeGbp(benchmarkFeeGbp: number, savingPercent: number): number {
  if (!Number.isFinite(benchmarkFeeGbp) || benchmarkFeeGbp <= 0) return 0;
  const pct = Math.min(
    SALES_CALCULATOR_TIER_MAX,
    Math.max(SALES_CALCULATOR_TIER_MIN, savingPercent)
  );
  return roundGbp(benchmarkFeeGbp * (1 - pct / 100));
}

export function monthlySavingGbp(benchmarkFeeGbp: number, blocharchFeeGbp: number): number {
  return roundGbp(Math.max(0, benchmarkFeeGbp - blocharchFeeGbp));
}

function roundGbp(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatGbp(value: number): string {
  return value.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
