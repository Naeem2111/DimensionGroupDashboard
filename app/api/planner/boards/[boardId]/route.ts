import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canEditBoard,
  canManageBoardMembers,
  canViewBoard,
  requirePlannerSession,
} from "@/lib/planner-access";
import { isProtectedSystemBoard } from "@/lib/planner-system-boards";
import {
  ensureDefaultColumnsOnBoard,
} from "@/lib/planner-columns-seed";
import {
  ensureDefaultLabelsOnBoard,
  purgeUnapprovedBoardLabels,
} from "@/lib/planner-labels-seed";

type Ctx = { params: Promise<{ boardId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canViewBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await purgeUnapprovedBoardLabels(boardId);
  await ensureDefaultLabelsOnBoard(boardId);
  await ensureDefaultColumnsOnBoard(boardId);

  const board = await prisma.plannerBoard.findUnique({
    where: { id: boardId },
    include: {
      owner: { select: { id: true, username: true } },
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          tasks: {
            orderBy: { sortOrder: "asc" },
            include: {
              assignee: { select: { id: true, username: true } },
              labels: { include: { label: true } },
            },
          },
        },
      },
      labels: { orderBy: { name: "asc" } },
      members: {
        include: { user: { select: { id: true, username: true, role: true } } },
      },
    },
  });

  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const urls = Array.from(
    new Set(
      board.columns.flatMap((c) => c.tasks.map((t) => t.architectUrl).filter(Boolean) as string[])
    )
  );
  const leads =
    urls.length > 0
      ? await prisma.lead.findMany({
          where: { architectUrl: { in: urls } },
          select: { architectUrl: true, stage: true },
        })
      : [];
  const leadMap = Object.fromEntries(leads.map((l) => [l.architectUrl, l.stage]));

  const payload = {
    ...board,
    kind: board.kind,
    athleteId: board.athleteId,
    isSystem: board.isSystem,
    opsProjectId: board.opsProjectId,
    columns: board.columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((t) => ({
        ...t,
        leadStage: t.architectUrl ? leadMap[t.architectUrl] ?? null : null,
      })),
    })),
    editable: await canEditBoard(user, boardId),
    canManageMembers: await canManageBoardMembers(user, boardId),
  };

  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.plannerBoard.findUnique({ where: { id: boardId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    isProtectedSystemBoard(existing.kind, existing.isSystem) &&
    user.role !== "admin"
  ) {
    return NextResponse.json({ error: "Only admin can edit fixed system boards" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title =
      typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined;
    const color = typeof body.color === "string" ? body.color.trim().slice(0, 32) : undefined;
    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.round(body.sortOrder)
        : undefined;

    const board = await prisma.plannerBoard.update({
      where: { id: boardId },
      data: {
        ...(title !== undefined && title.length > 0 ? { title } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      select: { id: true, title: true, color: true, sortOrder: true },
    });

    return NextResponse.json({ board });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  const board = await prisma.plannerBoard.findUnique({ where: { id: boardId } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isProtectedSystemBoard(board.kind, board.isSystem)) {
    return NextResponse.json({ error: "System boards cannot be deleted" }, { status: 403 });
  }
  if (user.role !== "admin" && board.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.plannerBoard.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true });
}
