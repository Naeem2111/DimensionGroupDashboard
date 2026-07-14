import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";
import {
  parseLinkedLabelName,
  syncBoardLabelLinkedTasks,
} from "@/lib/planner-label-column";

type Ctx = { params: Promise<{ columnId: string }> };

async function columnBoardId(columnId: string): Promise<string | null> {
  const col = await prisma.plannerColumn.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  return col?.boardId ?? null;
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { columnId } = await context.params;

  const boardId = await columnBoardId(columnId);
  if (!boardId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data: {
      title?: string;
      color?: string;
      sortOrder?: number;
      linkedLabelName?: string | null;
    } = {};
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 80);
    if (typeof body.color === "string") data.color = body.color.trim().slice(0, 32);
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
      data.sortOrder = Math.round(body.sortOrder);
    }
    const linkedLabelName = parseLinkedLabelName(body.linkedLabelName);
    if (body.linkedLabelName !== undefined) {
      if (
        body.linkedLabelName !== null &&
        body.linkedLabelName !== "" &&
        linkedLabelName === null
      ) {
        return NextResponse.json({ error: "Invalid linked label" }, { status: 400 });
      }
      data.linkedLabelName = linkedLabelName ?? null;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const column = await prisma.plannerColumn.update({
      where: { id: columnId },
      data,
      select: {
        id: true,
        title: true,
        color: true,
        sortOrder: true,
        boardId: true,
        linkedLabelName: true,
      },
    });

    if (data.linkedLabelName !== undefined) {
      await syncBoardLabelLinkedTasks(column.boardId);
    }

    return NextResponse.json({ column });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(_request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { columnId } = await context.params;

  const boardId = await columnBoardId(columnId);
  if (!boardId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskCount = await prisma.plannerTask.count({ where: { columnId } });
  if (taskCount > 0) {
    return NextResponse.json(
      { error: "Move or delete tasks in this column before removing it." },
      { status: 400 }
    );
  }

  const remaining = await prisma.plannerColumn.count({ where: { boardId } });
  if (remaining <= 1) {
    return NextResponse.json({ error: "Board must keep at least one column." }, { status: 400 });
  }

  await prisma.plannerColumn.delete({ where: { id: columnId } });
  return NextResponse.json({ ok: true });
}
