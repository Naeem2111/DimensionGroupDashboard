import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";
import {
  parseLinkedLabelName,
  syncBoardLabelLinkedTasks,
} from "@/lib/planner-label-column";

type Ctx = { params: Promise<{ boardId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const color = typeof body.color === "string" ? body.color.trim() : "#64748b";
    const linkedLabelName = parseLinkedLabelName(body.linkedLabelName);
    if (title.length < 1 || title.length > 80) {
      return NextResponse.json({ error: "Title 1–80 characters" }, { status: 400 });
    }
    if (body.linkedLabelName !== undefined && body.linkedLabelName !== null && body.linkedLabelName !== "" && linkedLabelName === null) {
      return NextResponse.json({ error: "Invalid linked label" }, { status: 400 });
    }

    const maxOrder = await prisma.plannerColumn.aggregate({
      where: { boardId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const column = await prisma.plannerColumn.create({
      data: {
        boardId,
        title,
        color: color.slice(0, 32) || "#64748b",
        sortOrder,
        ...(linkedLabelName !== undefined ? { linkedLabelName } : {}),
      },
      select: {
        id: true,
        title: true,
        color: true,
        sortOrder: true,
        linkedLabelName: true,
      },
    });

    if (linkedLabelName) await syncBoardLabelLinkedTasks(boardId);

    return NextResponse.json({ column }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
