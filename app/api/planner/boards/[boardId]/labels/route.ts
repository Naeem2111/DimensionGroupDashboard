import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditBoard, requirePlannerSession } from "@/lib/planner-access";

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
    const name = String(body.name || "").trim();
    const color = String(body.color || "#94a3b8").trim();
    if (name.length < 1 || name.length > 64) {
      return NextResponse.json({ error: "Label name 1–64 chars" }, { status: 400 });
    }

    const label = await prisma.plannerLabel.create({
      data: { boardId, name, color },
    });
    return NextResponse.json({ label }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
