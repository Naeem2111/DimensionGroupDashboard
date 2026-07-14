import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ labelId: string }> };

async function labelBoardId(labelId: string): Promise<string | null> {
  const row = await prisma.plannerLabel.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  return row?.boardId ?? null;
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { labelId } = await context.params;

  const boardId = await labelBoardId(labelId);
  if (!boardId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data: { name?: string; color?: string } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      const name = body.name.trim();
      if (name.length < 1 || name.length > 64) {
        return NextResponse.json({ error: "Label name 1–64 chars" }, { status: 400 });
      }
      data.name = name;
    }

    if (body.color !== undefined) {
      if (typeof body.color !== "string") {
        return NextResponse.json({ error: "Invalid color" }, { status: 400 });
      }
      const color = body.color.trim().slice(0, 32);
      if (!color) {
        return NextResponse.json({ error: "Invalid color" }, { status: 400 });
      }
      data.color = color;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const label = await prisma.plannerLabel.update({
      where: { id: labelId },
      data,
      select: { id: true, boardId: true, name: true, color: true },
    });

    return NextResponse.json({ label });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(_request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { labelId } = await context.params;

  const boardId = await labelBoardId(labelId);
  if (!boardId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.plannerLabel.delete({ where: { id: labelId } });
  return NextResponse.json({ ok: true });
}
