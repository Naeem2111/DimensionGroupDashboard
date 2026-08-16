import { mailComposeUrl } from "@/lib/gmail-compose";
import { normalizeLeadStage, type LeadStage } from "@/lib/leads";

export type OutreachTemplateId = "cold" | "follow_up" | "book_call" | "thank_you";

export type OutreachComposeInput = {
  email: string;
  name?: string | null;
  contact?: string | null;
  website?: string | null;
  stage?: string | null;
};

export type OutreachComposeResult = {
  templateId: OutreachTemplateId;
  templateName: string;
  to: string;
  subject: string;
  body: string;
  mailto: string;
  suggestedStageAfterSend: LeadStage | null;
};

function firstName(contact?: string | null, name?: string | null): string {
  const raw = (contact || name || "there").trim();
  return raw.split(/\s+/)[0] || "there";
}

function websiteLink(website?: string | null): string {
  const w = (website || "https://dimensiongroupglobal.com").trim();
  return w.replace(/^https?:\/\//i, "");
}

const TEMPLATES: Record<
  OutreachTemplateId,
  {
    name: string;
    subject: (p: { firstName: string; companyName: string }) => string;
    body: (p: { firstName: string; companyName: string; websiteLink: string }) => string;
    suggestedStageAfterSend: LeadStage | null;
  }
> = {
  cold: {
    name: "Cold outreach",
    subject: () => "Reducing Part 1 & Part 2 staffing costs by 25–40%",
    body: ({ firstName, companyName, websiteLink: link }) =>
      `Good day ${firstName},

I hope this email finds you well.

My name is Jethro Bloch, founder of Dimension Group.

Each year, we selectively reach out to a small number of architecture practices where we see a strong potential fit. Based on our research into ${companyName} and the work your team is involved in, I felt it was worth reaching out directly to explore whether there might be alignment — even if just as an initial conversation.

With rising employment costs, ongoing recruitment cycles, and the reality of Part 1 and Part 2 turnover, many practices are rethinking how they structure their production capacity. Dimension Group was built specifically to address this.

We provide dedicated, full-time Part 1 and Part 2–equivalent architectural staff who integrate directly into your existing team. Our team works within your established workflows and software — including Revit, AutoCAD, SketchUp, and Archicad, among others — and produces technical documentation aligned to your office conventions.

By stabilising production in this way, practices are able to realign internal resources — allowing Part 3 Architects, associates, and directors to spend more time on client relationships, site involvement, coordination, and business development, rather than being pulled back into day-to-day production.

Our model removes much of the hidden friction associated with junior staffing — including repeated recruitment, HR overhead, software licensing, equipment costs, and continuity loss — while providing long-term, dedicated architectural capacity, typically at a 25–40% saving compared to local hires.

Although our core team is based in Cape Town, we operate as a hybrid practice and work closely with firms on a long-term basis. We place strong value on building proper working relationships rather than operating as a remote, transactional service.

If this sounds worth exploring, I'd be happy to walk you through how we work on a short call and see whether it could be useful for ${companyName}, now or in the future.

Kind regards,
Jethro Bloch
Founder | Dimension Group
${link}`,
    suggestedStageAfterSend: "first_email_sent",
  },
  follow_up: {
    name: "Follow-up",
    subject: () => "Embedded Part 1 / Part 2 Support for Architecture Practices",
    body: ({ firstName, companyName, websiteLink: link }) =>
      `Good day ${firstName},

Just following up on my previous email in case it slipped through.

I reached out as we work closely with practices looking for reliable, long-term Part 1 / Part 2 production support — without the disruption that often comes with repeated recruitment and junior staff turnover.

We provide dedicated, full-time architectural staff through our Embedded Architect Model, who embed directly into your team and work within your existing workflows and office standards, offering consistent technical capacity over the long term rather than short-term or project-based assistance.

If helpful, I'd be glad to briefly explain how this works in practice and see whether it could support ${companyName}, now or later in the year.

No pressure at all — just thought it was worth checking back in.

Kind regards,
Jethro Bloch
Founder | Dimension Group
${link}`,
    suggestedStageAfterSend: "follow_up_sent",
  },
  book_call: {
    name: "Book call",
    subject: () => "Next steps & availability for a quick call",
    body: ({ firstName }) =>
      `Hi ${firstName},

Thank you for getting back to me — it's great to hear from you.

I'd be very happy to take this forward and explore things in a bit more detail.

As a next step, it would be helpful to set up a short Zoom call so we can better understand your current setup, workload, and where additional support could be most useful. From there, we can talk through how this could work in a way that genuinely adds value to your team.

If you're happy to proceed, please let me know your availability over the next week or so, and I'll coordinate a time that works best.

In the meantime, you're very welcome to have a look at our website (dimensiongroupglobal.com) for a bit more background on Dimension Group.

Looking forward to chatting further.

Kind regards,
Jethro Bloch
Founder | Dimension Group`,
    suggestedStageAfterSend: null,
  },
  thank_you: {
    name: "Thank you",
    subject: ({ firstName }) => `Thanks, ${firstName}`,
    body: ({ firstName, websiteLink: link }) =>
      `Hi ${firstName},

Thank you so much for getting back to me, I really appreciate you taking the time to review everything and for letting me know.

I completely understand, and thank you again for considering it. If anything changes in the future, or if there's ever a point where additional capacity or support might be helpful, please don't hesitate to reach out — I'd be very happy to reconnect.

Wishing you and the team all the best going forward.

Kind regards,
Jethro Bloch
Founder | Dimension Group
${link}`,
    suggestedStageAfterSend: null,
  },
};

export function pickTemplateForStage(stage?: string | null): OutreachTemplateId {
  const s = normalizeLeadStage(stage);
  if (s === "cold" || s === "targeted") return "cold";
  if (s === "first_email_sent" || s === "follow_up_due" || s === "follow_up_sent") return "follow_up";
  if (s === "positive_reply" || s === "interested" || s === "reply_received") return "book_call";
  if (s === "negative_reply" || s === "not_interested") return "thank_you";
  return "cold";
}

export function buildOutreachCompose(
  input: OutreachComposeInput,
  templateId?: OutreachTemplateId | string | null
): OutreachComposeResult {
  const to = (input.email || "").trim();
  if (!to) throw new Error("Practice has no email");

  const id = (templateId as OutreachTemplateId) || pickTemplateForStage(input.stage);
  const tpl = TEMPLATES[id] || TEMPLATES.cold;
  const vars = {
    firstName: firstName(input.contact, input.name),
    companyName: (input.name || "your practice").trim() || "your practice",
    websiteLink: websiteLink(input.website),
  };
  const subject = tpl.subject(vars);
  const body = tpl.body(vars);
  return {
    templateId: id in TEMPLATES ? id : "cold",
    templateName: tpl.name,
    to,
    subject,
    body,
    mailto: mailComposeUrl(to, { subject, body }),
    suggestedStageAfterSend: tpl.suggestedStageAfterSend,
  };
}

export const OUTREACH_TEMPLATE_OPTIONS: { id: OutreachTemplateId; name: string }[] = [
  { id: "cold", name: "Cold outreach" },
  { id: "follow_up", name: "Follow-up" },
  { id: "book_call", name: "Book call" },
  { id: "thank_you", name: "Thank you" },
];
