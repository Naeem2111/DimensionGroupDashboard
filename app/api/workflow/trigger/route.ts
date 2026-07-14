import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { loadTemplates, applyTemplate } from "@/lib/templates";
import { getOrCreateLead, updateLead } from "@/lib/leads";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/** Activate workflow: optionally call n8n webhook, mark leads as contacted */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const practiceUrls = (body.practiceUrls || body.urls || []) as string[];
  const templateId = (body.templateId || "intro") as string;
  const webhookUrl = process.env.N8N_WEBHOOK_URL || body.webhookUrl;
  const markAsContacted = body.markAsContacted !== false;

  const architects = await loadArchitects();
  const templates = loadTemplates();
  const template = templates.find((t) => t.id === templateId) || templates[0];

  const toProcess =
    practiceUrls.length > 0
      ? architects.filter((a) => practiceUrls.includes(a.url) || practiceUrls.includes(slugFromUrl(a.url)))
      : architects.filter((a) => a.email?.trim()).slice(0, 50);

  const payloads: Array<{
    practice: typeof architects[0];
    subject: string;
    body: string;
    email: string;
  }> = [];

  for (const practice of toProcess) {
    if (!practice.email?.trim()) continue;
    const { subject, body } = applyTemplate(template, {
      name: practice.name || "",
      contact: practice.contact || "Team",
      email: practice.email,
      website: practice.website || "",
    });
    payloads.push({ practice, subject, body, email: practice.email });
  }

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: payloads, templateId }),
      });
    } catch (e) {
      return Response.json(
        { error: "Webhook failed", detail: String(e) },
        { status: 502 }
      );
    }
  }

  if (markAsContacted) {
    const now = new Date().toISOString();
    for (const { practice } of payloads) {
      await updateLead(practice.url, { stage: "first_email_sent", lastEmailedAt: now });
    }
  }

  return Response.json({
    ok: true,
    processed: payloads.length,
    webhookCalled: !!webhookUrl,
    markAsContacted,
  });
}
