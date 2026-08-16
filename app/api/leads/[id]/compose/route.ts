import { NextRequest } from "next/server";
import { findArchitectBySlugOrUrl } from "@/lib/architects";
import { getOrCreateLead } from "@/lib/leads";
import {
  buildOutreachCompose,
  OUTREACH_TEMPLATE_OPTIONS,
  type OutreachTemplateId,
} from "@/lib/outreach-compose";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/leads/[id]/compose?template=cold
 * Returns autofilled subject/body + mailto for the practice (opens default mail app).
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const practice = await findArchitectBySlugOrUrl(decodeURIComponent(id));
  if (!practice) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }
  if (!practice.email?.trim()) {
    return Response.json({ error: "Practice has no email" }, { status: 400 });
  }

  const lead = await getOrCreateLead(practice.url);
  const templateParam = request.nextUrl.searchParams.get("template");
  const validIds = new Set(OUTREACH_TEMPLATE_OPTIONS.map((t) => t.id));
  const templateId =
    templateParam && validIds.has(templateParam as OutreachTemplateId)
      ? (templateParam as OutreachTemplateId)
      : undefined;

  try {
    const compose = buildOutreachCompose(
      {
        email: practice.email,
        name: practice.name,
        contact: practice.contact,
        website: practice.website,
        stage: lead.stage,
      },
      templateId
    );
    return Response.json({
      ...compose,
      practice: {
        url: practice.url,
        name: practice.name,
        email: practice.email,
        stage: lead.stage,
      },
      templates: OUTREACH_TEMPLATE_OPTIONS,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Compose failed" }, { status: 400 });
  }
}
