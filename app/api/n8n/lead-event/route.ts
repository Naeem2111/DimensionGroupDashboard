import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { appendLeadAutomationNote, LEAD_STAGES, type LeadStage } from "@/lib/leads";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

const EMAIL_IN_STRING = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function firstEmailFromToField(to: unknown): string {
  if (typeof to !== "string" || !to.trim()) return "";
  const m = to.match(/<([^>]+)>/);
  const raw = (m ? m[1] : to).trim();
  return normEmail(raw);
}

/** Pull addresses from arrays of strings or { address, emailAddress: { address } } shapes. */
function emailsFromLoose(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") {
    const m = val.match(EMAIL_IN_STRING);
    return m ? Array.from(new Set(m.map(normEmail))) : [];
  }
  if (Array.isArray(val)) {
    return val.flatMap((x) => emailsFromLoose(x));
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    if (typeof o.address === "string") return emailsFromLoose(o.address);
    if (o.emailAddress && typeof o.emailAddress === "object") {
      const ea = (o.emailAddress as { address?: string }).address;
      if (typeof ea === "string") return [normEmail(ea)];
    }
    return Object.values(o).flatMap((x) => emailsFromLoose(x));
  }
  return [];
}

/** Last-resort: any email-like string in JSON (Gmail API / n8n shapes vary). */
function scrapeEmailsFromBody(obj: unknown, depth = 0): string[] {
  if (depth > 10) return [];
  if (typeof obj === "string") {
    const m = obj.match(EMAIL_IN_STRING);
    return m ? m.map(normEmail) : [];
  }
  if (Array.isArray(obj)) return obj.flatMap((x) => scrapeEmailsFromBody(x, depth + 1));
  if (obj && typeof obj === "object") {
    return Object.values(obj as object).flatMap((x) => scrapeEmailsFromBody(x, depth + 1));
  }
  return [];
}

async function resolvePracticeUrl(
  body: Record<string, unknown>
): Promise<{ url: string } | { error: string; status: number }> {
  const architects = await loadArchitects();

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  if (leadId) {
    const hit = architects.find((a) => a.url === leadId);
    if (hit) return { url: hit.url };
    return { error: "Practice not found for lead_id", status: 404 };
  }

  const candidates: string[] = [];

  if (typeof body.email === "string" && body.email.trim()) {
    candidates.push(normEmail(body.email));
  }

  for (const key of ["to", "To", "receiver", "Receiver", "destination"]) {
    const v = body[key];
    candidates.push(...emailsFromLoose(v));
  }

  if (Array.isArray(body.toRecipients)) {
    candidates.push(...emailsFromLoose(body.toRecipients));
  }

  const payload = body.payload;
  if (payload && typeof payload === "object") {
    const headers = (payload as { headers?: unknown }).headers;
    if (Array.isArray(headers)) {
      for (const h of headers) {
        if (!h || typeof h !== "object") continue;
        const name = String((h as { name?: string }).name || "").toLowerCase();
        if (name === "to" || name === "delivered-to") {
          candidates.push(...emailsFromLoose((h as { value?: string }).value));
        }
      }
    }
  }

  const unique = Array.from(new Set(candidates.filter(Boolean)));
  for (const email of unique) {
    const hit = architects.find((a) => normEmail(a.email || "") === email);
    if (hit) return { url: hit.url };
  }

  const scraped = Array.from(new Set(scrapeEmailsFromBody(body)));
  for (const email of scraped) {
    const hit = architects.find((a) => normEmail(a.email || "") === email);
    if (hit) return { url: hit.url };
  }

  return {
    error:
      "Provide lead_id (practice URL), email, or a Gmail payload with recipient (to). " +
      "If n8n drops fields after Gmail, reference $('Map lead fields').item.json in the HTTP node body.",
    status: 400,
  };
}

/**
 * n8n callback after sending an email. Updates notes (timestamped), lastEmailedAt, optional stage.
 * POST /api/n8n/lead-event
 * Header: X-Api-Key: N8N_API_KEY (or ?apiKey=)
 *
 * Body JSON:
 * - lead_id?: full architectdirectory practice URL
 * - email?: practice email
 * - to?: string | array (Gmail-style "Name <a@b.com>" also works)
 * - appendNote: string (required)
 * - stage?: optional pipeline stage
 * - lastEmailedAt?: optional ISO string
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const appendNote = typeof body.appendNote === "string" ? body.appendNote.trim() : "";
  if (!appendNote) {
    return Response.json({ error: "appendNote is required" }, { status: 400 });
  }

  let stage: LeadStage | undefined;
  if (typeof body.stage === "string" && LEAD_STAGES.includes(body.stage as LeadStage)) {
    stage = body.stage as LeadStage;
  }

  const lastEmailedAt =
    typeof body.lastEmailedAt === "string" && body.lastEmailedAt.trim()
      ? body.lastEmailedAt.trim()
      : undefined;

  const resolved = await resolvePracticeUrl(body);
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }

  const lead = await appendLeadAutomationNote(resolved.url, appendNote, { stage, lastEmailedAt });
  return Response.json({ ok: true, lead });
}
