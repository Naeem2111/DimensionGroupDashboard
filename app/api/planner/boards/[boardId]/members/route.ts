import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { PlannerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageBoardMembers, requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ boardId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canManageBoardMembers(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const userId = String(body.userId || "");
    const role: PlannerMemberRole = body.role === "viewer" ? "viewer" : "editor";
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const member = await prisma.plannerBoardMember.upsert({
      where: { boardId_userId: { boardId, userId } },
      create: { boardId, userId, role },
      update: { role },
    });

    return NextResponse.json({ member });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
