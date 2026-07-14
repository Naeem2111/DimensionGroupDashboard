import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planBoardIdsForUser, requirePlannerSession } from "@/lib/planner-access";

/** Search tasks across kanbans visible to the current user (pick for todo list & personal board). */
export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const ids = await planBoardIdsForUser(user);
  if (ids.length === 0) return NextResponse.json({ tasks: [] });

  const url = new URL(request.url);
  const qRaw = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(150, Math.max(1, Number(url.searchParams.get("limit")) || 120));

  const tasks = await prisma.plannerTask.findMany({
    where: {
      column: { boardId: { in: ids } },
      ...(qRaw.length > 0
        ? {
            title: {
              contains: qRaw,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      summary: true,
      column: {
        select: {
          id: true,
          title: true,
          boardId: true,
          board: { select: { id: true, title: true, scope: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      columnId: t.column.id,
      columnTitle: t.column.title,
      boardId: t.column.board.id,
      boardTitle: t.column.board.title,
      scope: t.column.board.scope,
    })),
  });
}
