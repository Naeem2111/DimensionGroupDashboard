import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canViewBoard, requirePlannerSession } from "@/lib/planner-access";

export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const items = await prisma.plannerTodoItem.findMany({
    where: { userId: user.id },
    orderBy: [{ completed: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    include: {
      task: {
        select: {
          id: true,
          title: true,
          summary: true,
          column: {
            select: {
              id: true,
              title: true,
              board: { select: { id: true, title: true, scope: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ todos: items });
}

export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  let body: { taskId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: { column: { select: { boardId: true } } },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const boardId = task.column.boardId;
  if (!(await canViewBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxOrder = await prisma.plannerTodoItem.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  try {
    const row = await prisma.plannerTodoItem.create({
      data: { userId: user.id, taskId, sortOrder },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            summary: true,
            column: {
              select: {
                id: true,
                title: true,
                board: { select: { id: true, title: true, scope: true } },
              },
            },
          },
        },
      },
    });
    return NextResponse.json({ todo: row });
  } catch {
    return NextResponse.json({ error: "Already on your list or invalid" }, { status: 409 });
  }
}
