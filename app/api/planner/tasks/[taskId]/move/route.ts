import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { movePlannerTaskToColumn } from "@/lib/planner-move-task";
import { requirePlannerSession } from "@/lib/planner-access";

type Ctx = { params: Promise<{ taskId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { taskId } = await context.params;

  try {
    const body = await request.json();
    const columnId = String(body.columnId || "").trim();
    if (!columnId) {
      return NextResponse.json({ error: "columnId required" }, { status: 400 });
    }
    const insertBeforeTaskId =
      body.insertBeforeTaskId === null || body.insertBeforeTaskId === undefined
        ? null
        : String(body.insertBeforeTaskId).trim() || null;

    const result = await movePlannerTaskToColumn(user, taskId, columnId, insertBeforeTaskId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not move task";
    const status = msg === "Forbidden" || msg.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
