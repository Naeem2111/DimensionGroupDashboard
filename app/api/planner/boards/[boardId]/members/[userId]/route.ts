import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageBoardMembers, requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ boardId: string; userId: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId, userId } = await context.params;

  if (!(await canManageBoardMembers(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await prisma.plannerBoard.findUnique({ where: { id: boardId } });
  if (board?.ownerId === userId) {
    return NextResponse.json({ error: "Cannot remove board owner" }, { status: 400 });
  }

  await prisma.plannerBoardMember.deleteMany({ where: { boardId, userId } });
  return NextResponse.json({ ok: true });
}
