import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { markInboxTaskNotificationsRead } from "@/lib/athlete-inbox-notifications";
import { requireAthletePortalSession } from "@/lib/ops-access";

export async function POST(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  let body: { taskId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  await markInboxTaskNotificationsRead(athlete.id, taskId);
  return NextResponse.json({ ok: true });
}
