import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";
import { relocateTaskToLabelLinkedColumn } from "@/lib/planner-label-column";

const TASK_SUMMARY_MAX = 2_000;
const TASK_DESCRIPTION_MAX = 50_000;

type Ctx = { params: Promise<{ taskId: string }> };

function normalizeNullableLongText(raw: unknown, max: number): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const s = raw.replace(/\u200b/g, "").trimEnd().slice(0, max);
  return s.length === 0 ? null : s;
}

async function taskBoardId(taskId: string): Promise<string | null> {
  const t = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: { column: { select: { boardId: true } } },
  });
  return t?.column.boardId ?? null;
}

export async function PATCH(request: NextRequest, context: Ctx) {
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
    const data: Prisma.PlannerTaskUncheckedUpdateInput = {};

    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 200);
    const nextSummary = normalizeNullableLongText(body.summary, TASK_SUMMARY_MAX);
    if (nextSummary !== undefined) data.summary = nextSummary;
    const nextDesc = normalizeNullableLongText(body.description, TASK_DESCRIPTION_MAX);
    if (nextDesc !== undefined) data.description = nextDesc;
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }
    if (typeof body.columnId === "string" && body.columnId) {
      const newCol = await prisma.plannerColumn.findUnique({
        where: { id: body.columnId },
        select: { boardId: true },
      });
      if (!newCol) {
        return NextResponse.json({ error: "Invalid column" }, { status: 400 });
      }
      if (newCol.boardId !== boardId) {
        if (!(await canEditBoard(user, newCol.boardId))) {
          return NextResponse.json({ error: "Forbidden on target board" }, { status: 403 });
        }
      }
      data.columnId = body.columnId;
    }
    if (body.assigneeId === null) data.assigneeId = null;
    else if (typeof body.assigneeId === "string") data.assigneeId = body.assigneeId || null;

    if (body.dueAt === null) data.dueAt = null;
    else if (body.dueAt) data.dueAt = new Date(String(body.dueAt));

    if (body.architectUrl === null) data.architectUrl = null;
    else if (typeof body.architectUrl === "string") {
      data.architectUrl = body.architectUrl.trim() || null;
    }

    if (body.customFields !== undefined) {
      data.customFields =
        body.customFields === null ? Prisma.JsonNull : (body.customFields as Prisma.InputJsonValue);
    }

    await prisma.plannerTask.update({
      where: { id: taskId },
      data,
    });

    if (Array.isArray(body.labelIds)) {
      const ids = (body.labelIds as unknown[]).filter((x) => typeof x === "string") as string[];
      await prisma.plannerTaskLabel.deleteMany({ where: { taskId } });
      if (ids.length > 0) {
        await prisma.plannerTaskLabel.createMany({
          data: ids.map((labelId) => ({ taskId, labelId })),
          skipDuplicates: true,
        });
      }
      await relocateTaskToLabelLinkedColumn(taskId);
    }

    const task = await prisma.plannerTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, username: true } },
        labels: { include: { label: true } },
        column: { select: { id: true, boardId: true } },
      },
    });

    return NextResponse.json({ task });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { taskId } = await context.params;

  const boardId = await taskBoardId(taskId);
  if (!boardId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.plannerTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
