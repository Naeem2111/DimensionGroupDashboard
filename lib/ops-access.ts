import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { OpsAthlete, Prisma } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { canAccessModule, canAccessOpsOverview } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeMonthlyHoursSummary, monthEndUtc, monthStartUtc } from "@/lib/ops-hours";
import { projectDisplayFields } from "@/lib/project-display";
import { ensureLinkedAthleteProfile } from "@/lib/ops-athlete-profile";

export async function requireOpsSession(
  request: NextRequest
): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "ops")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.user.role === "admin") {
    await ensureLinkedAthleteProfile(session.user);
  }
  return { user: session.user };
}

/** Admin full ops or manager ops overview only. */
export async function requireOpsOverviewSession(
  request: NextRequest
): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessOpsOverview(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user: session.user };
}

export async function requireAthletePortalSession(
  request: NextRequest
): Promise<{ user: SessionUser; athlete: OpsAthlete } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "athlete_portal")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let athlete = await prisma.opsAthlete.findUnique({ where: { userId: session.user.id } });
  if (!athlete) {
    athlete = await ensureLinkedAthleteProfile(session.user);
  }
  if (!athlete) {
    return NextResponse.json({ error: "No athlete profile linked to this account" }, { status: 404 });
  }
  if (athlete.status !== "active") {
    return NextResponse.json({ error: "Athlete account is inactive" }, { status: 403 });
  }

  return { user: session.user, athlete };
}

export async function findAthleteForUser(userId: string) {
  return prisma.opsAthlete.findUnique({ where: { userId } });
}

export async function sumAthleteHoursInRange(athleteId: string, from: Date, to: Date) {
  const agg = await prisma.opsDailySubmission.aggregate({
    where: {
      athleteId,
      submissionDate: { gte: from, lte: to },
    },
    _sum: { totalHours: true },
  });
  return Number(agg._sum.totalHours ?? 0);
}

export async function athleteMonthlySummary(athlete: OpsAthlete, reference = new Date()) {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const monthHours = await sumAthleteHoursInRange(athlete.id, from, to);
  const lifetimeAgg = await prisma.opsDailySubmission.aggregate({
    where: { athleteId: athlete.id },
    _sum: { totalHours: true },
  });
  const lifetimeHours = Number(lifetimeAgg._sum.totalHours ?? 0);

  return {
    lifetimeHours,
    ...computeMonthlyHoursSummary({
      monthHours,
      monthlyHourCap: athlete.monthlyHourCap,
      baseMonthlyPayZar: Number(athlete.baseMonthlyPayZar),
      overtimeRateZar: Number(athlete.overtimeRateZar),
    }),
  };
}

export const athleteProjectSelect = {
  id: true,
  name: true,
  projectNumber: true,
  address: true,
  projectLead: true,
  complexity: true,
  startDate: true,
  dueDate: true,
  handoverDate: true,
  currentStage: true,
  currentStatus: true,
  progressPercent: true,
  notes: true,
  blockerFlag: true,
  checkInRequested: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      logoBgColor: true,
      logoTextTone: true,
    },
  },
} satisfies Prisma.OpsProjectSelect;

export function serializeProjectForAthlete(project: Prisma.OpsProjectGetPayload<{ select: typeof athleteProjectSelect }>) {
  const { displayTitle, stageLabel } = projectDisplayFields(project);
  return {
    ...project,
    displayTitle,
    stageLabel,
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: project.dueDate?.toISOString().slice(0, 10) ?? null,
    handoverDate: project.handoverDate?.toISOString().slice(0, 10) ?? null,
    updatedAt: project.updatedAt.toISOString(),
  };
}
