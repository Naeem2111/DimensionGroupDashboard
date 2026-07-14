import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const limit = Math.min(200, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "80", 10)));

  const rows = await prisma.opsNotification.findMany({
    where: unreadOnly ? { readAt: null } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      athlete: { select: { fullName: true, athleteCode: true } },
    },
  });

  const projectIds = rows.map((r) => r.projectId).filter((id): id is string => !!id);
  const projects =
    projectIds.length > 0
      ? await prisma.opsProject.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return NextResponse.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      actionRequired: r.actionRequired,
      athleteName: r.athlete?.fullName ?? null,
      athleteCode: r.athlete?.athleteCode ?? null,
      projectName: r.projectId ? projectMap[r.projectId] ?? null : null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    unreadCount: unreadOnly
      ? rows.length
      : await prisma.opsNotification.count({ where: { readAt: null } }),
  });
}
