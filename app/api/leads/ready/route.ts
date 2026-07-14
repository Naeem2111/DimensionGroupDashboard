import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { getOrCreateLead } from "@/lib/leads";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/** For n8n or external workflows: returns leads with email, optionally filtered by stage */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage") || undefined;
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));
  const withEmailOnly = searchParams.get("withEmail") !== "false";

  const architects = await loadArchitects();
  const leads = (await Promise.all(
    architects.map(async (a) => {
      const lead = await getOrCreateLead(a.url);
      return { ...a, slug: slugFromUrl(a.url), lead };
    })
  ))
    .filter((x) => !withEmailOnly || (x.email?.trim()))
    .filter((x) => !stage || x.lead.stage === stage)
    .slice(0, limit);

  return Response.json({ leads });
}
