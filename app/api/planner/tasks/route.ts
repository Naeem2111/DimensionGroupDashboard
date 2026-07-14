import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";

const TASK_SUMMARY_MAX = 2_000;
const TASK_DESCRIPTION_MAX = 50_000;

function optionalLongText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\u200b/g, "").trimEnd().slice(0, max);
  return s.length === 0 ? null : s;
}

export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  try {
    const body = await request.json();
    const columnId = String(body.columnId || "");
    const title = String(body.title || "").trim();

    if (!columnId || title.length < 1 || title.length > 200) {
      return NextResponse.json({ error: "columnId and title (1–200) required" }, { status: 400 });
    }

    const col = await prisma.plannerColumn.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });
    if (!col) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    if (!(await canEditBoard(user, col.boardId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const maxOrder = await prisma.plannerTask.aggregate({
      where: { columnId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const task = await prisma.plannerTask.create({
      data: {
        columnId,
        title,
        summary: optionalLongText(body.summary, TASK_SUMMARY_MAX),
        description: optionalLongText(body.description, TASK_DESCRIPTION_MAX),
        sortOrder,
        assigneeId:
          typeof body.assigneeId === "string" && body.assigneeId ? body.assigneeId : null,
        dueAt: body.dueAt ? new Date(String(body.dueAt)) : null,
        architectUrl:
          typeof body.architectUrl === "string" && body.architectUrl.trim()
            ? body.architectUrl.trim()
            : null,
        customFields: body.customFields && typeof body.customFields === "object" ? body.customFields : undefined,
      },
      include: {
        assignee: { select: { id: true, username: true } },
        labels: { include: { label: true } },
      },
    });

    if (Array.isArray(body.labelIds) && body.labelIds.length > 0) {
      const ids = body.labelIds.filter((x: unknown) => typeof x === "string") as string[];
      await prisma.plannerTaskLabel.createMany({
        data: ids.map((labelId) => ({ taskId: task.id, labelId })),
        skipDuplicates: true,
      });
    }

    const full = await prisma.plannerTask.findUnique({
      where: { id: task.id },
      include: {
        assignee: { select: { id: true, username: true } },
        labels: { include: { label: true } },
      },
    });

    return NextResponse.json({ task: full }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
