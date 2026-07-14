import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ boardId: string }> };

type ColumnOrder = { columnId: string; taskIds: string[] };

/** Atomic apply of Kanban ordering: every task moves to listed column/index. */
export async function POST(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cols = body as { columns?: ColumnOrder[] };
  if (!Array.isArray(cols.columns) || cols.columns.length === 0) {
    return NextResponse.json({ error: "columns required" }, { status: 400 });
  }

  const boardCols = await prisma.plannerColumn.findMany({
    where: { boardId },
    select: { id: true, tasks: { select: { id: true } } },
  });

  if (boardCols.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dbColumnIds = new Set(boardCols.map((c) => c.id));
  const incomingColumnIds = new Set(cols.columns.map((c) => String(c.columnId || "")));

  if (incomingColumnIds.size !== dbColumnIds.size || !Array.from(incomingColumnIds).every((id) => dbColumnIds.has(id))) {
    return NextResponse.json({ error: "Column set must match board" }, { status: 400 });
  }

  const allTaskIds = new Set(boardCols.flatMap((c) => c.tasks.map((t) => t.id)));
  const planned = new Map<string, { columnId: string; sortOrder: number }>();

  for (const col of cols.columns) {
    const columnId = String(col.columnId || "");
    if (!dbColumnIds.has(columnId)) {
      return NextResponse.json({ error: "Invalid column id" }, { status: 400 });
    }
    if (!Array.isArray(col.taskIds)) {
      return NextResponse.json({ error: "taskIds must be arrays" }, { status: 400 });
    }
    for (let i = 0; i < col.taskIds.length; i++) {
      const taskId = String(col.taskIds[i] ?? "");
      if (!taskId) {
        return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
      }
      if (planned.has(taskId)) {
        return NextResponse.json({ error: "Duplicate task in payload" }, { status: 400 });
      }
      planned.set(taskId, { columnId, sortOrder: i });
    }
  }

  if (planned.size !== allTaskIds.size) {
    return NextResponse.json({ error: "Task set must match board" }, { status: 400 });
  }

  for (const tid of Array.from(planned.keys())) {
    if (!allTaskIds.has(tid)) return NextResponse.json({ error: "Unknown task id" }, { status: 400 });
  }

  await prisma.$transaction(
    Array.from(planned.entries()).map(([taskId, { columnId, sortOrder }]) =>
      prisma.plannerTask.update({
        where: { id: taskId },
        data: { columnId, sortOrder },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
