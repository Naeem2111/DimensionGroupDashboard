import type { OpsExchangeRateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchLiveGbpToZarQuote } from "@/lib/fx-live";
import { getCostConversionMode } from "@/lib/ops-commercial-settings";
import { monthStartUtc } from "@/lib/ops-hours";

export function isOpsExchangeRateType(v: string): v is OpsExchangeRateType {
  return v === "live" || v === "reporting";
}

/** First day of month UTC for a reference date. */
export function effectiveMonthUtc(date: Date): Date {
  return monthStartUtc(date);
}

export async function getActiveExchangeRate(
  reference: Date,
  rateType: OpsExchangeRateType
): Promise<number | null> {
  const month = effectiveMonthUtc(reference);
  const row = await prisma.opsExchangeRate.findFirst({
    where: { effectiveMonth: month, rateType, activeFlag: true },
    orderBy: { createdAt: "desc" },
  });
  return row ? Number(row.gbpToZarRate) : null;
}

export async function getReportingRateOrDefault(reference: Date): Promise<number> {
  const rate = await getActiveExchangeRate(reference, "reporting");
  return rate ?? 24;
}

export async function getLiveRateOrDefault(reference: Date): Promise<number> {
  const stored = await getActiveExchangeRate(reference, "live");
  if (stored != null) return stored;
  try {
    const quote = await fetchLiveGbpToZarQuote();
    return quote.gbpToZarRate;
  } catch {
    return getReportingRateOrDefault(reference);
  }
}

export type CostConversionSnapshot = {
  mode: "manual" | "live";
  appliedRate: number;
  reportingRate: number;
  liveRate: number | null;
};

/** Rate used to convert athlete ZAR earnings → GBP on Commercial. */
export async function getCostConversionSnapshot(reference: Date): Promise<CostConversionSnapshot> {
  const mode = await getCostConversionMode();
  const reportingRate = await getReportingRateOrDefault(reference);
  let liveRate: number | null = await getActiveExchangeRate(reference, "live");
  if (liveRate == null) {
    try {
      const quote = await fetchLiveGbpToZarQuote();
      liveRate = quote.gbpToZarRate;
    } catch {
      liveRate = null;
    }
  }
  const appliedRate = mode === "live" ? (liveRate ?? reportingRate) : reportingRate;
  return {
    mode,
    appliedRate,
    reportingRate,
    liveRate,
  };
}

export async function upsertActiveExchangeRate(input: {
  effectiveMonth: Date;
  rateType: OpsExchangeRateType;
  gbpToZarRate: number;
}): Promise<void> {
  const effectiveMonth = effectiveMonthUtc(input.effectiveMonth);
  await prisma.opsExchangeRate.updateMany({
    where: { effectiveMonth, rateType: input.rateType, activeFlag: true },
    data: { activeFlag: false },
  });
  await prisma.opsExchangeRate.create({
    data: {
      effectiveMonth,
      rateType: input.rateType,
      gbpToZarRate: input.gbpToZarRate,
      activeFlag: true,
    },
  });
}
