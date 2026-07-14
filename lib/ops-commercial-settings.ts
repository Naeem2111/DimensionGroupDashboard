import { prisma } from "@/lib/prisma";

const COST_RATE_MODE_KEY = "commercial_cost_rate_mode";

export type CostConversionMode = "manual" | "live";

export async function getCostConversionMode(): Promise<CostConversionMode> {
  const row = await prisma.opsAppSetting.findUnique({
    where: { key: COST_RATE_MODE_KEY },
    select: { value: true },
  });
  return row?.value === "live" ? "live" : "manual";
}

export async function setCostConversionMode(mode: CostConversionMode): Promise<void> {
  await prisma.opsAppSetting.upsert({
    where: { key: COST_RATE_MODE_KEY },
    create: { key: COST_RATE_MODE_KEY, value: mode },
    update: { value: mode },
  });
}
