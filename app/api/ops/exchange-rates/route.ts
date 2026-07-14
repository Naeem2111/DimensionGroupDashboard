import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import { effectiveMonthUtc, isOpsExchangeRateType } from "@/lib/ops-exchange";
import { parseDateOnly } from "@/lib/ops-hours";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const rates = await prisma.opsExchangeRate.findMany({
    orderBy: [{ effectiveMonth: "desc" }, { rateType: "asc" }, { createdAt: "desc" }],
    take: 48,
  });

  return NextResponse.json({
    rates: rates.map((r) => ({
      id: r.id,
      effectiveMonth: r.effectiveMonth.toISOString().slice(0, 7),
      gbpToZarRate: Number(r.gbpToZarRate),
      rateType: r.rateType,
      activeFlag: r.activeFlag,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const monthRaw = String(body.effectiveMonth || "").trim();
    const monthDate = parseDateOnly(`${monthRaw.length === 7 ? `${monthRaw}-01` : monthRaw}`);
    if (!monthDate) {
      return NextResponse.json({ error: "effectiveMonth must be YYYY-MM" }, { status: 400 });
    }

    const rateTypeRaw = String(body.rateType || "reporting");
    if (!isOpsExchangeRateType(rateTypeRaw)) {
      return NextResponse.json({ error: 'rateType must be "live" or "reporting"' }, { status: 400 });
    }

    const gbpToZarRate = Number(body.gbpToZarRate);
    if (!Number.isFinite(gbpToZarRate) || gbpToZarRate <= 0) {
      return NextResponse.json({ error: "gbpToZarRate must be a positive number" }, { status: 400 });
    }

    const effectiveMonth = effectiveMonthUtc(monthDate);
    const activeFlag = body.activeFlag !== false;

    if (activeFlag) {
      await prisma.opsExchangeRate.updateMany({
        where: { effectiveMonth, rateType: rateTypeRaw, activeFlag: true },
        data: { activeFlag: false },
      });
    }

    const rate = await prisma.opsExchangeRate.create({
      data: {
        effectiveMonth,
        gbpToZarRate,
        rateType: rateTypeRaw,
        activeFlag,
      },
    });

    return NextResponse.json(
      {
        rate: {
          id: rate.id,
          effectiveMonth: rate.effectiveMonth.toISOString().slice(0, 7),
          gbpToZarRate: Number(rate.gbpToZarRate),
          rateType: rate.rateType,
          activeFlag: rate.activeFlag,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
