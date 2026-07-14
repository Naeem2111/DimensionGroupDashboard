import { prisma } from "@/lib/prisma";
import type { LeadStage } from "@/lib/leads";
import { LEAD_STAGES, normalizeLeadStage, updateLead } from "@/lib/leads";

export const COMMUNICATION_TYPES = [
  "first_email",
  "follow_up_email",
  "inbound_reply",
  "whatsapp",
  "linkedin",
  "call",
  "note",
  "other",
] as const;

export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

export const COMMUNICATION_DIRECTIONS = ["outbound", "inbound"] as const;
export type CommunicationDirection = (typeof COMMUNICATION_DIRECTIONS)[number];

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  first_email: "First email",
  follow_up_email: "Follow-up email",
  inbound_reply: "Inbound reply",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  call: "Call",
  note: "Note",
  other: "Other",
};

export const FOLLOW_UP_FILTERS = ["due_today", "overdue"] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

/** Stages where automatic follow-up reminders stop unless a new date is set manually. */
export const REMINDER_STOP_STAGES: LeadStage[] = [
  "interested",
  "client_onboarded",
  "negative_reply",
  "not_interested",
];

export type FollowUpStatus = "none" | "scheduled" | "due_today" | "overdue";

export type OutreachLogRecord = {
  id: string;
  stageAtLog: LeadStage;
  communicationType: CommunicationType;
  direction: CommunicationDirection;
  contactPerson?: string;
  emailAddress?: string;
  subject?: string;
  messageBody?: string;
  replyReceived?: string;
  internalNotes?: string;
  contactDate: string;
  followUpDueAt?: string;
  nextAction?: string;
  createdAt: string;
};

export type OutreachSummary = {
  firstContactedAt?: string;
  lastContactedAt?: string;
  latestStage: LeadStage;
  effectiveStage: LeadStage;
  followUpDueAt?: string;
  followUpStatus: FollowUpStatus;
  touchCount: number;
  nextAction?: string;
  lastCommunicationType?: CommunicationType;
  hasInboundReply: boolean;
};

export type CreateOutreachLogInput = {
  stageAtLog: LeadStage;
  communicationType: CommunicationType;
  direction: CommunicationDirection;
  contactPerson?: string;
  emailAddress?: string;
  subject?: string;
  messageBody?: string;
  replyReceived?: string;
  internalNotes?: string;
  contactDate: string;
  followUpDueAt?: string | null;
  nextAction?: string;
};

export type UpdateOutreachLogInput = CreateOutreachLogInput;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnly(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid contact date");
  return startOfDay(d);
}

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString();
}

function mapLog(row: {
  id: string;
  stageAtLog: string;
  communicationType: string;
  direction: string;
  contactPerson: string | null;
  emailAddress: string | null;
  subject: string | null;
  messageBody: string | null;
  replyReceived: string | null;
  internalNotes: string | null;
  contactDate: Date;
  followUpDueAt: Date | null;
  nextAction: string | null;
  createdAt: Date;
}): OutreachLogRecord {
  return {
    id: row.id,
    stageAtLog: normalizeLeadStage(row.stageAtLog),
    communicationType: row.communicationType as CommunicationType,
    direction: row.direction as CommunicationDirection,
    contactPerson: row.contactPerson || undefined,
    emailAddress: row.emailAddress || undefined,
    subject: row.subject || undefined,
    messageBody: row.messageBody || undefined,
    replyReceived: row.replyReceived || undefined,
    internalNotes: row.internalNotes || undefined,
    contactDate: row.contactDate.toISOString(),
    followUpDueAt: toIso(row.followUpDueAt),
    nextAction: row.nextAction || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function computeFollowUpStatus(
  followUpDueAt: Date | null | undefined,
  stage: LeadStage
): FollowUpStatus {
  if (!followUpDueAt || REMINDER_STOP_STAGES.includes(stage)) return "none";
  const today = startOfDay(new Date());
  const due = startOfDay(followUpDueAt);
  if (due.getTime() === today.getTime()) return "due_today";
  if (due < today) return "overdue";
  return "scheduled";
}

export function computeEffectiveStage(
  stage: LeadStage,
  followUpDueAt: Date | null | undefined
): LeadStage {
  const normalized = normalizeLeadStage(stage);
  const status = computeFollowUpStatus(followUpDueAt, normalized);
  if (status === "due_today" || status === "overdue") return "follow_up_due";
  return normalized;
}

export function daysOverdue(followUpDueAt: Date | null | undefined, stage: LeadStage): number {
  const status = computeFollowUpStatus(followUpDueAt, stage);
  if (status !== "overdue" || !followUpDueAt) return 0;
  const today = startOfDay(new Date());
  const due = startOfDay(followUpDueAt);
  return Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
}

export async function syncLeadFollowUpStage(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  const effective = computeEffectiveStage(normalizeLeadStage(lead.stage), lead.followUpDueAt);
  if (effective === "follow_up_due" && lead.stage !== "follow_up_due") {
    await prisma.lead.update({
      where: { id: leadId },
      data: { stage: "follow_up_due" },
    });
  } else if (
    lead.stage === "follow_up_due" &&
    effective !== "follow_up_due" &&
    normalizeLeadStage(lead.stage) !== "follow_up_due"
  ) {
    // restored when follow-up logged — stage already updated by log create
  }
}

export async function syncAllFollowUpDueStages(): Promise<void> {
  const leads = await prisma.lead.findMany({
    where: {
      followUpDueAt: { not: null },
      stage: { notIn: REMINDER_STOP_STAGES },
    },
    select: { id: true, stage: true, followUpDueAt: true },
  });
  for (const lead of leads) {
    const effective = computeEffectiveStage(normalizeLeadStage(lead.stage), lead.followUpDueAt);
    if (effective === "follow_up_due" && lead.stage !== "follow_up_due") {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "follow_up_due" } });
    }
  }
}

export async function getLeadIdForPractice(practiceUrl: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({
    where: { architectUrl: practiceUrl },
    select: { id: true },
  });
  return lead?.id ?? null;
}

export async function listOutreachLogs(practiceUrl: string): Promise<OutreachLogRecord[]> {
  const leadId = await getLeadIdForPractice(practiceUrl);
  if (!leadId) return [];
  const rows = await prisma.leadOutreachLog.findMany({
    where: { leadId },
    orderBy: { contactDate: "desc" },
  });
  return rows.map(mapLog);
}

export async function getOutreachSummary(practiceUrl: string): Promise<OutreachSummary> {
  const lead = await prisma.lead.findUnique({
    where: { architectUrl: practiceUrl },
    include: {
      outreachLogs: {
        orderBy: { contactDate: "asc" },
        select: { contactDate: true, direction: true, communicationType: true },
      },
    },
  });

  if (!lead) {
    return {
      latestStage: "cold",
      effectiveStage: "cold",
      followUpStatus: "none",
      touchCount: 0,
      hasInboundReply: false,
    };
  }

  const stage = normalizeLeadStage(lead.stage);
  const effectiveStage = computeEffectiveStage(stage, lead.followUpDueAt);
  const outboundTouches = lead.outreachLogs.filter((l) => l.direction === "outbound").length;
  const hasInboundReply = lead.outreachLogs.some(
    (l) => l.direction === "inbound" || l.communicationType === "inbound_reply"
  );

  return {
    firstContactedAt: toIso(lead.outreachLogs[0]?.contactDate),
    lastContactedAt: toIso(lead.lastContactedAt ?? lead.outreachLogs.at(-1)?.contactDate),
    latestStage: stage,
    effectiveStage,
    followUpDueAt: toIso(lead.followUpDueAt),
    followUpStatus: computeFollowUpStatus(lead.followUpDueAt, stage),
    touchCount: lead.touchCount || outboundTouches,
    nextAction: lead.nextAction || undefined,
    lastCommunicationType: (lead.lastCommunicationType as CommunicationType | null) || undefined,
    hasInboundReply,
  };
}

function countOutboundTouches(logs: { direction: string }[]): number {
  return logs.filter((l) => l.direction === "outbound").length;
}

export async function createOutreachLog(
  practiceUrl: string,
  input: CreateOutreachLogInput
): Promise<{ log: OutreachLogRecord; summary: OutreachSummary }> {
  if (!LEAD_STAGES.includes(input.stageAtLog)) {
    throw new Error("Invalid stage");
  }
  if (!COMMUNICATION_TYPES.includes(input.communicationType)) {
    throw new Error("Invalid communication type");
  }
  if (!COMMUNICATION_DIRECTIONS.includes(input.direction)) {
    throw new Error("Invalid direction");
  }

  const contactDate = new Date(input.contactDate);
  if (Number.isNaN(contactDate.getTime())) throw new Error("Invalid contact date");

  let lead = await prisma.lead.findUnique({ where: { architectUrl: practiceUrl } });
  if (!lead) {
    lead = await prisma.lead.create({
      data: { architectUrl: practiceUrl, stage: "cold", rating: 0 },
    });
  }

  const followUpDueAt = input.followUpDueAt ? parseDateOnly(input.followUpDueAt) : null;
  let nextFollowUp = followUpDueAt;
  if (REMINDER_STOP_STAGES.includes(input.stageAtLog) && input.followUpDueAt === undefined) {
    nextFollowUp = null;
  }

  const log = await prisma.leadOutreachLog.create({
    data: {
      leadId: lead.id,
      stageAtLog: input.stageAtLog,
      communicationType: input.communicationType,
      direction: input.direction,
      contactPerson: input.contactPerson?.trim() || null,
      emailAddress: input.emailAddress?.trim() || null,
      subject: input.subject?.trim() || null,
      messageBody: input.messageBody?.trim() || null,
      replyReceived: input.replyReceived?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
      contactDate,
      followUpDueAt: nextFollowUp,
      nextAction: input.nextAction?.trim() || null,
    },
  });

  const allLogs = await prisma.leadOutreachLog.findMany({
    where: { leadId: lead.id },
    select: { direction: true },
  });
  const touchCount = countOutboundTouches(allLogs);
  const newStage = computeEffectiveStage(input.stageAtLog, nextFollowUp);

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: newStage,
      followUpDueAt: nextFollowUp,
      lastContactedAt: contactDate,
      lastEmailedAt: input.direction === "outbound" ? contactDate : lead.lastEmailedAt,
      lastCommunicationType: input.communicationType,
      touchCount,
      nextAction: input.nextAction?.trim() || null,
    },
  });

  const noteLine = `[${contactDate.toISOString()}] ${COMMUNICATION_TYPE_LABELS[input.communicationType]} (${input.direction})${
    input.subject ? `: ${input.subject}` : ""
  }`;
  await updateLead(practiceUrl, {
    notes: [lead.notes?.trim(), noteLine].filter(Boolean).join("\n"),
    lastEmailedAt: input.direction === "outbound" ? contactDate.toISOString() : undefined,
  });

  const summary = await getOutreachSummary(practiceUrl);
  return { log: mapLog(log), summary };
}

function validateOutreachInput(input: CreateOutreachLogInput): Date {
  if (!LEAD_STAGES.includes(input.stageAtLog)) throw new Error("Invalid stage");
  if (!COMMUNICATION_TYPES.includes(input.communicationType)) {
    throw new Error("Invalid communication type");
  }
  if (!COMMUNICATION_DIRECTIONS.includes(input.direction)) {
    throw new Error("Invalid direction");
  }
  const contactDate = new Date(input.contactDate);
  if (Number.isNaN(contactDate.getTime())) throw new Error("Invalid contact date");
  return contactDate;
}

function resolveFollowUpDueAt(
  stageAtLog: LeadStage,
  followUpDueAt: string | null | undefined
): Date | null {
  const parsed = followUpDueAt ? parseDateOnly(followUpDueAt) : null;
  if (REMINDER_STOP_STAGES.includes(stageAtLog) && followUpDueAt === undefined) {
    return null;
  }
  return parsed;
}

/** Recompute lead stage and follow-up fields from remaining outreach logs. */
export async function reconcileLeadFromLogs(leadId: string): Promise<void> {
  const remaining = await prisma.leadOutreachLog.findMany({
    where: { leadId },
    orderBy: [{ contactDate: "desc" }, { createdAt: "desc" }],
  });

  if (remaining.length === 0) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        stage: "cold",
        followUpDueAt: null,
        lastContactedAt: null,
        lastEmailedAt: null,
        lastCommunicationType: null,
        touchCount: 0,
        nextAction: null,
      },
    });
    return;
  }

  const latest = remaining[0]!;
  const touchCount = countOutboundTouches(remaining);
  const latestOutbound = remaining.find((l) => l.direction === "outbound");
  const stage = computeEffectiveStage(
    normalizeLeadStage(latest.stageAtLog),
    latest.followUpDueAt
  );

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage,
      followUpDueAt: latest.followUpDueAt,
      lastContactedAt: latest.contactDate,
      lastCommunicationType: latest.communicationType,
      touchCount,
      nextAction: latest.nextAction,
      lastEmailedAt: latestOutbound?.contactDate ?? null,
    },
  });
}

async function getOutreachLogForPractice(practiceUrl: string, logId: string) {
  const lead = await prisma.lead.findUnique({ where: { architectUrl: practiceUrl } });
  if (!lead) return null;
  const log = await prisma.leadOutreachLog.findFirst({
    where: { id: logId, leadId: lead.id },
  });
  return log ? { lead, log } : null;
}

export async function updateOutreachLog(
  practiceUrl: string,
  logId: string,
  input: UpdateOutreachLogInput
): Promise<{ log: OutreachLogRecord; summary: OutreachSummary }> {
  const found = await getOutreachLogForPractice(practiceUrl, logId);
  if (!found) throw new Error("Log entry not found");

  const contactDate = validateOutreachInput(input);
  const nextFollowUp = resolveFollowUpDueAt(input.stageAtLog, input.followUpDueAt);

  const updated = await prisma.leadOutreachLog.update({
    where: { id: logId },
    data: {
      stageAtLog: input.stageAtLog,
      communicationType: input.communicationType,
      direction: input.direction,
      contactPerson: input.contactPerson?.trim() || null,
      emailAddress: input.emailAddress?.trim() || null,
      subject: input.subject?.trim() || null,
      messageBody: input.messageBody?.trim() || null,
      replyReceived: input.replyReceived?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
      contactDate,
      followUpDueAt: nextFollowUp,
      nextAction: input.nextAction?.trim() || null,
    },
  });

  await reconcileLeadFromLogs(found.lead.id);
  const summary = await getOutreachSummary(practiceUrl);
  return { log: mapLog(updated), summary };
}

export async function deleteOutreachLog(
  practiceUrl: string,
  logId: string
): Promise<{ summary: OutreachSummary }> {
  const found = await getOutreachLogForPractice(practiceUrl, logId);
  if (!found) throw new Error("Log entry not found");

  await prisma.leadOutreachLog.delete({ where: { id: logId } });
  await reconcileLeadFromLogs(found.lead.id);
  const summary = await getOutreachSummary(practiceUrl);
  return { summary };
}

export type MarketingNotificationItem = {
  practiceUrl: string;
  practiceSlug: string;
  practiceName: string;
  stage: LeadStage;
  effectiveStage: LeadStage;
  lastContactedAt?: string;
  followUpDueAt?: string;
  followUpStatus: FollowUpStatus;
  daysOverdue: number;
  nextAction?: string;
};

export async function listMarketingNotifications(): Promise<MarketingNotificationItem[]> {
  await syncAllFollowUpDueStages();

  const architects = await prisma.architect.findMany({
    select: {
      url: true,
      name: true,
      lead: {
        select: {
          stage: true,
          lastContactedAt: true,
          followUpDueAt: true,
          nextAction: true,
        },
      },
    },
  });

  const items: MarketingNotificationItem[] = [];

  for (const a of architects) {
    if (!a.lead?.followUpDueAt) continue;
    const stage = normalizeLeadStage(a.lead.stage);
    const status = computeFollowUpStatus(a.lead.followUpDueAt, stage);
    if (status !== "due_today" && status !== "overdue") continue;

    const slugMatch = a.url.match(/\/practice\/([^/]+)\/?$/);
    const slug = slugMatch ? slugMatch[1] : "";

    items.push({
      practiceUrl: a.url,
      practiceSlug: slug,
      practiceName: a.name,
      stage,
      effectiveStage: "follow_up_due",
      lastContactedAt: toIso(a.lead.lastContactedAt),
      followUpDueAt: toIso(a.lead.followUpDueAt),
      followUpStatus: status,
      daysOverdue: daysOverdue(a.lead.followUpDueAt, stage),
      nextAction: a.lead.nextAction || undefined,
    });
  }

  items.sort((a, b) => {
    if (a.followUpStatus === "overdue" && b.followUpStatus !== "overdue") return -1;
    if (b.followUpStatus === "overdue" && a.followUpStatus !== "overdue") return 1;
    const aDue = a.followUpDueAt ? new Date(a.followUpDueAt).getTime() : 0;
    const bDue = b.followUpDueAt ? new Date(b.followUpDueAt).getTime() : 0;
    return aDue - bDue;
  });

  return items;
}

export type MarketingDueDateItem = {
  practiceUrl: string;
  practiceSlug: string;
  practiceName: string;
  followUpDueAt: string;
  effectiveStage: LeadStage;
  followUpStatus: FollowUpStatus;
  nextAction?: string;
};

/** All scheduled marketing follow-ups for calendar views (excludes closed pipeline stages). */
export async function listMarketingFollowUpDates(): Promise<MarketingDueDateItem[]> {
  await syncAllFollowUpDueStages();

  const architects = await prisma.architect.findMany({
    where: {
      lead: { followUpDueAt: { not: null } },
    },
    select: {
      url: true,
      name: true,
      lead: {
        select: {
          stage: true,
          followUpDueAt: true,
          nextAction: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const items: MarketingDueDateItem[] = [];

  for (const a of architects) {
    if (!a.lead?.followUpDueAt) continue;
    const stage = normalizeLeadStage(a.lead.stage);
    if (REMINDER_STOP_STAGES.includes(stage)) continue;

    const slugMatch = a.url.match(/\/practice\/([^/]+)\/?$/);
    const slug = slugMatch ? slugMatch[1] : "";

    items.push({
      practiceUrl: a.url,
      practiceSlug: slug,
      practiceName: a.name,
      followUpDueAt: toIso(a.lead.followUpDueAt)!,
      effectiveStage: computeEffectiveStage(stage, a.lead.followUpDueAt),
      followUpStatus: computeFollowUpStatus(a.lead.followUpDueAt, stage),
      nextAction: a.lead.nextAction || undefined,
    });
  }

  items.sort(
    (a, b) => new Date(a.followUpDueAt).getTime() - new Date(b.followUpDueAt).getTime()
  );

  return items;
}

export function matchesLeadFilter(
  filter: string,
  lead: {
    stage: LeadStage;
    followUpDueAt?: Date | null;
    touchCount: number;
    hasInboundReply: boolean;
  }
): boolean {
  if (!filter) return true;
  const stage = normalizeLeadStage(lead.stage);
  const effective = computeEffectiveStage(stage, lead.followUpDueAt ?? null);
  const followUpStatus = computeFollowUpStatus(lead.followUpDueAt ?? null, stage);

  switch (filter) {
    case "due_today":
      return followUpStatus === "due_today";
    case "overdue":
      return followUpStatus === "overdue";
    case "no_reply":
      return lead.touchCount > 0 && !lead.hasInboundReply && !REMINDER_STOP_STAGES.includes(stage);
    default:
      if (filter === "follow_up_due") return effective === "follow_up_due";
      return stage === filter || effective === filter;
  }
}
