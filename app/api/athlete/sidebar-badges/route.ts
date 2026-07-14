import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const [unreadNotifications, unreadInboxTasks] = await Promise.all([
    prisma.opsAthleteNotification.count({
      where: { athleteId: athlete.id, readAt: null },
    }),
    prisma.opsAthleteNotification.count({
      where: {
        athleteId: athlete.id,
        readAt: null,
        type: "task_assigned",
      },
    }),
  ]);

  return NextResponse.json({
    notifications: unreadNotifications,
    inbox: unreadInboxTasks,
    urgent: unreadNotifications > 0,
  });
}
