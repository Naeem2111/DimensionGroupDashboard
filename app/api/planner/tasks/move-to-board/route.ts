import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, canViewBoard, requirePlannerSession } from "@/lib/planner-access";
import { resolveGeneralColumnId } from "@/lib/planner-default-columns";
import { findLinkedColumnForBoard, relocateTaskToLabelLinkedColumn } from "@/lib/planner-label-column";

async function resolveDefaultColumnId(boardId: string): Promise<string | null> {
  const cols = await prisma.plannerColumn.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true },
  });
  return resolveGeneralColumnId(cols);
}

/** Move an inbox task onto another board; auto-places by linked label column when possible. */
export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  let body: { sourceTaskId?: string; targetBoardId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sourceTaskId =
    typeof body.sourceTaskId === "string" ? body.sourceTaskId.trim() : "";
  const targetBoardId =
    typeof body.targetBoardId === "string" ? body.targetBoardId.trim() : "";
  if (!sourceTaskId || !targetBoardId) {
    return NextResponse.json({ error: "sourceTaskId and targetBoardId required" }, { status: 400 });
  }

  const source = await prisma.plannerTask.findUnique({
    where: { id: sourceTaskId },
    include: {
      column: { include: { board: { select: { id: true, kind: true } } } },
      labels: { include: { label: { select: { name: true } } } },
    },
  });
  if (!source) return NextResponse.json({ error: "Source task not found" }, { status: 404 });

  const sourceBoard = source.column.board;
  if (!(await canViewBoard(user, sourceBoard.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (sourceBoard.kind !== "blocharch_inbox") {
    return NextResponse.json(
      { error: "Only tasks in Blocharch Inbox can be routed to another board here" },
      { status: 400 }
    );
  }
  if (!(await canEditBoard(user, targetBoardId))) {
    return NextResponse.json({ error: "Forbidden on target board" }, { status: 403 });
  }

  const targetBoard = await prisma.plannerBoard.findUnique({
    where: { id: targetBoardId },
    select: { id: true, kind: true },
  });
  if (!targetBoard) return NextResponse.json({ error: "Target board not found" }, { status: 404 });
  if (targetBoard.kind === "blocharch_inbox" || targetBoard.kind === "blocharch_outbox") {
    return NextResponse.json({ error: "Invalid target board" }, { status: 400 });
  }

  const labelNames = source.labels.map((l) => l.label.name);
  let destColumnId = await findLinkedColumnForBoard(targetBoardId, labelNames);
  if (!destColumnId) destColumnId = await resolveDefaultColumnId(targetBoardId);
  if (!destColumnId) {
    return NextResponse.json({ error: "Target board has no columns" }, { status: 400 });
  }

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: destColumnId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  await prisma.plannerTask.update({
    where: { id: source.id },
    data: { columnId: destColumnId, sortOrder },
  });

  await relocateTaskToLabelLinkedColumn(source.id);

  const task = await prisma.plannerTask.findUnique({
    where: { id: source.id },
    include: {
      assignee: { select: { id: true, username: true } },
      labels: { include: { label: true } },
      column: { select: { id: true, boardId: true } },
    },
  });

  return NextResponse.json({
    task,
    targetBoardId,
    moved: true,
  });
}
