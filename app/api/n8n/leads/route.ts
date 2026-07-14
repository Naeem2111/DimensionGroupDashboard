import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { getOrCreateLead } from "@/lib/leads";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/**
 * n8n workflow endpoint. Returns leads with outreach_stage for routing.
 * GET /api/n8n/leads?status=cold&limit=200&withEmail=true
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200", 10)));
  const withEmail = searchParams.get("withEmail") !== "false";

  const architects = await loadArchitects();
  const leads = (await Promise.all(
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
  ))
    .filter((x) => !withEmail || (x.email?.trim()))
    .filter((x) => !status || x.outreach_stage === status)
    .slice(0, limit);

  return Response.json({ leads });
}
