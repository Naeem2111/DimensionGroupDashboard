import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;
  const { id } = await context.params;

  const row = await prisma.opsAthleteNotification.findFirst({
    where: { id, athleteId: athlete.id },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const markRead = body.read !== false;

  const updated = await prisma.opsAthleteNotification.update({
    where: { id },
    data: { readAt: markRead ? new Date() : null },
  });

  return NextResponse.json({
    notification: {
      id: updated.id,
      readAt: updated.readAt?.toISOString() ?? null,
    },
  });
}
