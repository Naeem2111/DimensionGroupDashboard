import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";
import { setPlannerTaskCompleted } from "@/lib/planner-completed";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ taskId: string }> };

async function taskBoardId(taskId: string): Promise<string | null> {
  const t = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: { column: { select: { boardId: true } } },
  });
  return t?.column.boardId ?? null;
}

export async function POST(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { taskId } = await context.params;

  const boardId = await taskBoardId(taskId);
  if (!boardId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const completed = Boolean(body.completed);
    const result = await setPlannerTaskCompleted(taskId, completed);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update task";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
