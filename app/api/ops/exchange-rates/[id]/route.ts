import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsExchangeRate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Rate not found" }, { status: 404 });

  try {
    const body = await request.json();
    const activeFlag = body.activeFlag === true;

    if (activeFlag) {
      await prisma.opsExchangeRate.updateMany({
        where: {
          effectiveMonth: existing.effectiveMonth,
          rateType: existing.rateType,
          activeFlag: true,
          id: { not: id },
        },
        data: { activeFlag: false },
      });
    }

    const rate = await prisma.opsExchangeRate.update({
      where: { id },
      data: { activeFlag },
    });

    return NextResponse.json({
      rate: {
        id: rate.id,
        effectiveMonth: rate.effectiveMonth.toISOString().slice(0, 7),
        gbpToZarRate: Number(rate.gbpToZarRate),
        rateType: rate.rateType,
        activeFlag: rate.activeFlag,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
