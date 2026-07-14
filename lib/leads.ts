import { prisma } from "@/lib/prisma";
import type { LeadCommunicationType } from "@prisma/client";

/** Outreach pipeline stages for lead nurturing. */
export const LEAD_STAGES = [
  "cold",
  "targeted",
  "first_email_sent",
  "follow_up_due",
  "follow_up_sent",
  "reply_received",
  "positive_reply",
  "interested",
  "client_onboarded",
  "negative_reply",
  "not_interested",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

/** All stages including deprecated DB values. */
export const ALL_LEAD_STAGES = [
  ...LEAD_STAGES,
  "no_reply",
  "follow_up_interested",
  "follow_up_not_interested",
] as const;

export type LeadStageDb = (typeof ALL_LEAD_STAGES)[number];

export interface LeadRecord {
  stage: LeadStage;
  rating: number;
  notes?: string;
  software?: string;
  softwareOther?: string;
  lastEmailedAt?: string;
  lastContactedAt?: string;
  followUpDueAt?: string;
  lastCommunicationType?: string;
  touchCount?: number;
  nextAction?: string;
}

export interface LeadsData {
  [practiceUrl: string]: LeadRecord;
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

const OLD_TO_NEW_STAGE: Record<string, LeadStage> = {
  new: "cold",
  contacted: "first_email_sent",
  no_reply: "first_email_sent",
  qualified: "positive_reply",
  won: "client_onboarded",
  lost: "negative_reply",
  follow_up_interested: "interested",
  follow_up_not_interested: "not_interested",
};

export function normalizeLeadStage(value: unknown): LeadStage {
  if (typeof value !== "string") return "cold";
  if (LEAD_STAGES.includes(value as LeadStage)) return value as LeadStage;
  return OLD_TO_NEW_STAGE[value] ?? "cold";
}

export async function loadLeads(): Promise<LeadsData> {
  const rows = await prisma.lead.findMany();
  return Object.fromEntries(
    rows.map((row) => [
      row.architectUrl,
      {
        stage: normalizeLeadStage(row.stage),
        rating: clampRating(row.rating),
        notes: row.notes || undefined,
        software: row.software || undefined,
        softwareOther: row.softwareOther || undefined,
        lastEmailedAt: row.lastEmailedAt?.toISOString(),
        lastContactedAt: row.lastContactedAt?.toISOString(),
        followUpDueAt: row.followUpDueAt?.toISOString(),
        lastCommunicationType: row.lastCommunicationType || undefined,
        touchCount: row.touchCount,
        nextAction: row.nextAction || undefined,
      },
    ])
  );
}

export async function getLead(practiceUrl: string): Promise<LeadRecord | null> {
  const r = await prisma.lead.findUnique({
    where: { architectUrl: practiceUrl },
  });
  if (!r) return null;
  return {
    stage: normalizeLeadStage(r.stage),
    rating: clampRating(r.rating),
    notes: r.notes || undefined,
    software: r.software || undefined,
    softwareOther: r.softwareOther || undefined,
    lastEmailedAt: r.lastEmailedAt?.toISOString(),
    lastContactedAt: r.lastContactedAt?.toISOString(),
    followUpDueAt: r.followUpDueAt?.toISOString(),
    lastCommunicationType: r.lastCommunicationType || undefined,
    touchCount: r.touchCount,
    nextAction: r.nextAction || undefined,
  };
}

export async function getOrCreateLead(practiceUrl: string): Promise<LeadRecord> {
  const existing = await getLead(practiceUrl);
  if (existing) return existing;
  await prisma.lead.create({
    data: {
      architectUrl: practiceUrl,
      stage: "cold",
      rating: 0,
    },
  });
  return { stage: "cold", rating: 0, touchCount: 0 };
}

export async function updateLead(
  practiceUrl: string,
  updates: Partial<
    Pick<
      LeadRecord,
      "stage" | "rating" | "notes" | "software" | "softwareOther" | "nextAction" | "lastCommunicationType"
    >
  > & {
    lastEmailedAt?: string | null;
    lastContactedAt?: string | null;
    followUpDueAt?: string | null;
    touchCount?: number;
  }
): Promise<LeadRecord> {
  const current = await getOrCreateLead(practiceUrl);
  const nextSoftware =
    updates.software !== undefined ? updates.software?.trim() || undefined : current.software;
  const nextSoftwareOther =
    nextSoftware === "other"
      ? updates.softwareOther !== undefined
        ? updates.softwareOther.trim() || undefined
        : current.softwareOther
      : undefined;
  const next: LeadRecord = {
    ...current,
    ...updates,
    stage: updates.stage ? normalizeLeadStage(updates.stage) : current.stage,
    rating: updates.rating !== undefined ? clampRating(updates.rating) : current.rating,
    software: nextSoftware,
    softwareOther: nextSoftwareOther,
    lastEmailedAt:
      updates.lastEmailedAt !== undefined
        ? updates.lastEmailedAt || undefined
        : current.lastEmailedAt,
    lastContactedAt:
      updates.lastContactedAt !== undefined
        ? updates.lastContactedAt || undefined
        : current.lastContactedAt,
    followUpDueAt:
      updates.followUpDueAt !== undefined ? updates.followUpDueAt || undefined : current.followUpDueAt,
    touchCount: updates.touchCount !== undefined ? updates.touchCount : current.touchCount,
  };
  await prisma.lead.upsert({
    where: { architectUrl: practiceUrl },
    update: {
      stage: next.stage,
      rating: next.rating,
      notes: next.notes,
      software: next.software ?? null,
      softwareOther: next.softwareOther ?? null,
      lastEmailedAt: next.lastEmailedAt ? new Date(next.lastEmailedAt) : null,
      lastContactedAt: next.lastContactedAt ? new Date(next.lastContactedAt) : null,
      followUpDueAt: next.followUpDueAt ? new Date(next.followUpDueAt) : null,
      lastCommunicationType: (next.lastCommunicationType as LeadCommunicationType | undefined) ?? null,
      touchCount: next.touchCount ?? 0,
      nextAction: next.nextAction ?? null,
    },
    create: {
      architectUrl: practiceUrl,
      stage: next.stage,
      rating: next.rating,
      notes: next.notes,
      software: next.software ?? null,
      softwareOther: next.softwareOther ?? null,
      lastEmailedAt: next.lastEmailedAt ? new Date(next.lastEmailedAt) : null,
      lastContactedAt: next.lastContactedAt ? new Date(next.lastContactedAt) : null,
      followUpDueAt: next.followUpDueAt ? new Date(next.followUpDueAt) : null,
      lastCommunicationType: (next.lastCommunicationType as LeadCommunicationType | undefined) ?? null,
      touchCount: next.touchCount ?? 0,
      nextAction: next.nextAction ?? null,
    },
  });
  return next;
}

/** Append a timestamped line from n8n (or other automation) and set lastEmailedAt. */
export async function appendLeadAutomationNote(
  practiceUrl: string,
  appendNote: string,
  options?: { stage?: LeadStage; lastEmailedAt?: string }
): Promise<LeadRecord> {
  const ts = options?.lastEmailedAt || new Date().toISOString();
  const line = `[${ts}] ${appendNote.trim()}`;
  const current = await getOrCreateLead(practiceUrl);
  const prev = (current.notes || "").trim();
  const notes = prev ? `${prev}\n${line}` : line;
  return await updateLead(practiceUrl, {
    notes,
    lastEmailedAt: ts,
    lastContactedAt: ts,
    ...(options?.stage ? { stage: normalizeLeadStage(options.stage) } : {}),
  });
}
