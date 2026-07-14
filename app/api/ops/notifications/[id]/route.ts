import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const read = body.read !== false;
    const row = await prisma.opsNotification.update({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });
    return NextResponse.json({
      notification: { id: row.id, readAt: row.readAt?.toISOString() ?? null },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
