import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import {
  createOutreachLog,
  getOutreachSummary,
  listOutreachLogs,
  type CreateOutreachLogInput,
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  const [logs, summary] = await Promise.all([listOutreachLogs(url), getOutreachSummary(url)]);
  return Response.json({ logs, summary });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<CreateOutreachLogInput>;
  if (!body.stageAtLog || !body.communicationType || !body.direction || !body.contactDate) {
    return Response.json(
      { error: "stageAtLog, communicationType, direction, and contactDate are required" },
      { status: 400 }
    );
  }

  try {
    const result = await createOutreachLog(url, body as CreateOutreachLogInput);
    return Response.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create log entry";
    return Response.json({ error: message }, { status: 400 });
  }
}
