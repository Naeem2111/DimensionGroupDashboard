import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ todoId: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { todoId } = await context.params;

  const row = await prisma.plannerTodoItem.findUnique({
    where: { id: todoId },
  });
  if (!row || row.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { completed?: boolean; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { completed?: boolean; sortOrder?: number } = {};
  if (typeof body.completed === "boolean") data.completed = body.completed;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const updated = await prisma.plannerTodoItem.update({
    where: { id: todoId },
    data,
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

  return NextResponse.json({ todo: updated });
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { todoId } = await context.params;

  const row = await prisma.plannerTodoItem.findUnique({ where: { id: todoId } });
  if (!row || row.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.plannerTodoItem.delete({ where: { id: todoId } });
  return NextResponse.json({ ok: true });
}
