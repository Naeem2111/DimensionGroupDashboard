import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import {
  deleteOutreachLog,
  updateOutreachLog,
  type UpdateOutreachLogInput,
} from "@/lib/lead-outreach";

async function resolvePracticeUrl(id: string): Promise<string | null> {
  const architects = await loadArchitects();
  const decoded = decodeURIComponent(id);
  const practice = architects.find((a) => {
    const m = a.url.match(/\/practice\/([^/]+)\/?$/);
    const slug = m ? m[1] : "";
    return a.url === decoded || a.url === id || slug === decoded || slug === id;
  });
  return practice?.url ?? null;
}

type RouteContext = { params: Promise<{ id: string; logId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, logId } = await context.params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<UpdateOutreachLogInput>;
  if (!body.stageAtLog || !body.communicationType || !body.direction || !body.contactDate) {
    return Response.json(
      { error: "stageAtLog, communicationType, direction, and contactDate are required" },
      { status: 400 }
    );
  }

  try {
    const result = await updateOutreachLog(url, logId, body as UpdateOutreachLogInput);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update log entry";
    const status = message === "Log entry not found" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id, logId } = await context.params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  try {
    const result = await deleteOutreachLog(url, logId);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete log entry";
    const status = message === "Log entry not found" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
