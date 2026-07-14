import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { getOutreachSummary } from "@/lib/lead-outreach";
import { getOrCreateLead, updateLead, normalizeLeadStage, LEAD_STAGES, type LeadStage } from "@/lib/leads";
import { isPracticeSoftwareId } from "@/lib/practice-software";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: {
    stage?: LeadStage;
    rating?: number;
    notes?: string;
    software?: string;
    softwareOther?: string;
    lastEmailedAt?: string | null;
    followUpDueAt?: string | null;
    nextAction?: string;
  } = {};

  if (body.stage && LEAD_STAGES.includes(body.stage)) {
    updates.stage = normalizeLeadStage(body.stage);
  }
  if (typeof body.rating === "number") {
    updates.rating = body.rating;
  }
  if (typeof body.notes === "string") {
    updates.notes = body.notes;
  }
  if (body.software === null || body.software === "") {
    updates.software = "";
    updates.softwareOther = "";
  } else if (typeof body.software === "string") {
    const software = body.software.trim();
    if (software && !isPracticeSoftwareId(software)) {
      return Response.json({ error: "Invalid software option" }, { status: 400 });
    }
    updates.software = software;
    if (software !== "other") {
      updates.softwareOther = "";
    }
  }
  if (typeof body.softwareOther === "string") {
    updates.softwareOther = body.softwareOther.trim();
  }
  if (typeof body.lastEmailedAt === "string") {
    const trimmed = body.lastEmailedAt.trim();
    updates.lastEmailedAt = trimmed ? trimmed : null;
  }
  if (typeof body.followUpDueAt === "string") {
    const trimmed = body.followUpDueAt.trim();
    updates.followUpDueAt = trimmed ? trimmed : null;
  }
  if (typeof body.nextAction === "string") {
    updates.nextAction = body.nextAction.trim();
  }

  const lead = await updateLead(url, updates);
  const summary = await getOutreachSummary(url);
  return Response.json({ ...lead, outreach: summary });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }
  await getOrCreateLead(url);
  const lead = await getOrCreateLead(url);
  const summary = await getOutreachSummary(url);
  return Response.json({ ...lead, outreach: summary });
}
