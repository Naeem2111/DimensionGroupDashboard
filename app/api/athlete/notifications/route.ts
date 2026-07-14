import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "50", 10)));

  const rows = await prisma.opsAthleteNotification.findMany({
    where: {
      athleteId: athlete.id,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.opsAthleteNotification.count({
    where: { athleteId: athlete.id, readAt: null },
  });

  return NextResponse.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      linkPath: r.linkPath,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
