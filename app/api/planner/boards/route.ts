import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PLANNER_COLUMNS,
  planBoardIdsForUser,
  requirePlannerSession,
} from "@/lib/planner-access";
import { DEFAULT_BOARD_LABELS } from "@/lib/planner-default-labels";

export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const ownerUserId = request.nextUrl.searchParams.get("ownerUserId")?.trim() || null;

  const ids = await planBoardIdsForUser(user);
  if (ids.length === 0) {
    return NextResponse.json({ boards: [] });
  }

  const boards = await prisma.plannerBoard.findMany({
    where: {
      id: { in: ids },
      ...(ownerUserId ? { ownerId: ownerUserId } : {}),
      OR: [
        { kind: { not: "project" } },
        { opsProjectId: null },
        {
          opsProject: {
            currentStatus: { notIn: ["completed", "handed_over"] },
          },
        },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      scope: true,
      kind: true,
      isSystem: true,
      color: true,
      sortOrder: true,
      ownerId: true,
      athleteId: true,
      updatedAt: true,
      owner: { select: { username: true } },
      _count: { select: { columns: true } },
    },
  });

  const ownerKey = ownerUserId ?? user.id;
  const ownerBoards = boards.filter((b) => b.ownerId === ownerKey);
  if (ownerBoards.length > 1) {
    const orders = new Set(ownerBoards.map((b) => b.sortOrder));
    if (orders.size <= 1) {
      await Promise.all(
        ownerBoards.map((b, i) =>
          prisma.plannerBoard.update({ where: { id: b.id }, data: { sortOrder: i } })
        )
      );
      ownerBoards.forEach((b, i) => {
        b.sortOrder = i;
      });
    }
  }

  return NextResponse.json({ boards });
}

export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const scope = body.scope === "team" ? "team" : "personal";
    const color = typeof body.color === "string" ? body.color.trim() : "#6366f1";

    if (title.length < 1 || title.length > 120) {
      return NextResponse.json({ error: "Title required (1–120 characters)" }, { status: 400 });
    }

    const maxOrder = await prisma.plannerBoard.aggregate({
      where: { ownerId: user.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const board = await prisma.plannerBoard.create({
      data: {
        title,
        scope,
        color: color || "#6366f1",
        sortOrder,
        ownerId: user.id,
        columns: {
          create: DEFAULT_PLANNER_COLUMNS.map((c) => ({
            title: c.title,
            color: c.color,
            sortOrder: c.sortOrder,
            linkedLabelName: c.linkedLabelName,
          })),
        },
        labels: {
          create: DEFAULT_BOARD_LABELS.map((l) => ({
            name: l.name,
            color: l.color,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        scope: true,
        color: true,
        ownerId: true,
      },
    });

    return NextResponse.json({ board }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
