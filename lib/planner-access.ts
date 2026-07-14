import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requirePlannerSession(
  request: NextRequest
): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { user: session.user };
}

export async function findBoard(boardId: string) {
  return prisma.plannerBoard.findUnique({
    where: { id: boardId },
    include: {
      members: true,
    },
  });
}

export async function canViewBoard(user: SessionUser, boardId: string): Promise<boolean> {
  const board = await findBoard(boardId);
  if (!board) return false;
  if (user.role === "admin") return true;
  if (board.ownerId === user.id) return true;
  if (board.scope === "team") {
    if (user.role === "manager") return true;
    const m = await prisma.plannerBoardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
    });
    return !!m;
  }
  return false;
}

export async function canEditBoard(user: SessionUser, boardId: string): Promise<boolean> {
  const board = await findBoard(boardId);
  if (!board) return false;
  if (user.role === "admin") return true;
  if (board.ownerId === user.id) return true;
  if (board.scope === "team") {
    if (user.role === "manager") return true;
    const m = await prisma.plannerBoardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
    });
    return !!m && m.role === "editor";
  }
  return board.ownerId === user.id;
}

export async function planBoardIdsForUser(user: SessionUser): Promise<string[]> {
  if (user.role === "admin") {
    const all = await prisma.plannerBoard.findMany({ select: { id: true } });
    return all.map((b) => b.id);
  }

  const owned = await prisma.plannerBoard.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const member = await prisma.plannerBoardMember.findMany({
    where: { userId: user.id },
    select: { boardId: true },
  });
  const ids = new Set<string>([...owned.map((b) => b.id), ...member.map((m) => m.boardId)]);

  if (user.role === "manager") {
    const team = await prisma.plannerBoard.findMany({
      where: { scope: "team" },
      select: { id: true },
    });
    team.forEach((b) => ids.add(b.id));
  }

  return Array.from(ids);
}

export { DEFAULT_PLANNER_COLUMNS, resolveGeneralColumnId } from "@/lib/planner-default-columns";

export async function canManageBoardMembers(user: SessionUser, boardId: string): Promise<boolean> {
  const board = await findBoard(boardId);
  if (!board) return false;
  if (user.role === "admin") return true;
  if (board.ownerId === user.id) return true;
  if (board.scope === "team" && user.role === "manager") return true;
  return false;
}
