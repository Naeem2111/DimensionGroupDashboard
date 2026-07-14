import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import {
  computeEffectiveStage,
  computeFollowUpStatus,
  matchesLeadFilter,
  syncAllFollowUpDueStages,
} from "@/lib/lead-outreach";
import { COMMUNICATION_TYPE_LABELS } from "@/lib/lead-outreach";
import { getOrCreateLead, normalizeLeadStage } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("stage") || searchParams.get("filter") || "";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = Math.min(50, Math.max(10, parseInt(searchParams.get("perPage") || "25", 10)));
  const withEmailOnly = searchParams.get("withEmail") === "true";

  await syncAllFollowUpDueStages();

  const architects = await loadArchitects();
  let items = await Promise.all(
    architects.map(async (a) => {
      const lead = await getOrCreateLead(a.url);
      const dbLead = await prisma.lead.findUnique({
        where: { architectUrl: a.url },
        include: {
          outreachLogs: {
            select: { direction: true, communicationType: true },
          },
        },
      });
      const stage = normalizeLeadStage(dbLead?.stage ?? lead.stage);
      const followUpDueAt = dbLead?.followUpDueAt ?? null;
      const effectiveStage = computeEffectiveStage(stage, followUpDueAt);
      const followUpStatus = computeFollowUpStatus(followUpDueAt, stage);
      const hasInboundReply =
        dbLead?.outreachLogs.some(
          (l) => l.direction === "inbound" || l.communicationType === "inbound_reply"
        ) ?? false;
      const lastCommType = dbLead?.lastCommunicationType;
      return {
        ...a,
        slug: slugFromUrl(a.url),
        lead: {
          stage,
          effectiveStage,
          rating: lead.rating,
          notes: lead.notes,
          lastEmailedAt: lead.lastEmailedAt,
          lastContactedAt: lead.lastContactedAt,
          followUpDueAt: dbLead?.followUpDueAt?.toISOString() ?? lead.followUpDueAt,
          followUpStatus,
          lastCommunicationType: lastCommType
            ? COMMUNICATION_TYPE_LABELS[lastCommType as keyof typeof COMMUNICATION_TYPE_LABELS] ??
              lastCommType
            : undefined,
          touchCount: dbLead?.touchCount ?? 0,
          nextAction: lead.nextAction,
        },
        _filterMeta: {
          stage,
          followUpDueAt,
          touchCount: dbLead?.touchCount ?? 0,
          hasInboundReply,
        },
      };
    })
  );

  if (filter) {
    items = items.filter((x) => matchesLeadFilter(filter, x._filterMeta));
  }
  if (withEmailOnly) {
    items = items.filter((a) => a.email?.trim());
  }
  if (q) {
    items = items.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.contact?.toLowerCase().includes(q) ||
        a.address?.toLowerCase().includes(q) ||
        a.lead.nextAction?.toLowerCase().includes(q)
    );
  }

  const total = items.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginated = items.slice(start, start + perPage).map(({ _filterMeta, ...rest }) => rest);

  return Response.json({
    items: paginated,
    total,
    page,
    totalPages,
  });
}
