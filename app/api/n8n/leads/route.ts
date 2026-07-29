import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { getOrCreateLead, normalizeLeadStage } from "@/lib/leads";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/**
 * n8n workflow endpoint. Returns leads with outreach_stage for routing.
 * GET /api/n8n/leads?status=cold&limit=200&withEmail=true
 * status may be comma-separated, e.g. cold,targeted or first_email_sent,follow_up_due
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status") || "";
  const statusSet = new Set(
    statusRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => normalizeLeadStage(s))
  );
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200", 10)));
  const withEmail = searchParams.get("withEmail") !== "false";

  const architects = await loadArchitects();
  const leads = (
    await Promise.all(
      architects.map(async (a) => {
        const lead = await getOrCreateLead(a.url);
        return {
          ...a,
          slug: slugFromUrl(a.url),
          outreach_stage: lead.stage,
          practice_id: slugFromUrl(a.url),
          lead_id: a.url,
        };
      })
    )
  )
    .filter((x) => !withEmail || Boolean(x.email?.trim()))
    .filter((x) => statusSet.size === 0 || statusSet.has(normalizeLeadStage(x.outreach_stage)))
    .slice(0, limit);

  return Response.json({ leads, count: leads.length });
}
