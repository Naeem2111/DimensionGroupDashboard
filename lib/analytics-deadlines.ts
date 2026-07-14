import type { Prisma } from "@prisma/client";
import { athleteProfileVisual } from "@/lib/athlete-profile-visual";
import { prisma } from "@/lib/prisma";
import { dateOnlyUtc, monthEndUtc, monthStartUtc } from "@/lib/ops-hours";

export type BeatenDeadlineProject = {
  projectId: string;
  projectName: string;
  clientName: string;
  dueDate: string;
  completedDate: string;
  daysBeaten: number;
};

export type BeatenDeadlinesByAthlete = {
  athleteId: string;
  athleteName: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  beatenCount: number;
  totalDaysBeaten: number;
  averageDaysBeaten: number;
  projects: BeatenDeadlineProject[];
};

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

/** Projects completed before due date in the selected month. */
export async function buildBeatenDeadlines(
  reference: Date,
  clientId?: string | null,
  athleteId?: string | null
): Promise<BeatenDeadlinesByAthlete[]> {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);

  const where: Prisma.OpsProjectWhereInput = {
    currentStatus: { in: ["completed", "handed_over"] },
    dueDate: { not: null },
    assignedAthleteId: { not: null },
    ...(clientId ? { clientId } : {}),
    ...(athleteId ? { assignedAthleteId: athleteId } : {}),
  };

  const projects = await prisma.opsProject.findMany({
    where,
    include: {
      client: { select: { name: true } },
      assignedAthlete: {
        select: {
          id: true,
          fullName: true,
          profilePhotoUrl: true,
          profilePhotoBgColor: true,
          profilePhotoTextTone: true,
        },
      },
    },
  });

  const byAthlete = new Map<string, BeatenDeadlinesByAthlete>();

  for (const p of projects) {
    if (!p.dueDate || !p.assignedAthlete) continue;

    const completed =
      p.completedAt != null
        ? dateOnlyUtc(p.completedAt)
        : p.handoverDate
          ? dateOnlyUtc(p.handoverDate)
          : dateOnlyUtc(p.updatedAt);
    if (completed < from || completed > to) continue;

    const due = dateOnlyUtc(p.dueDate);
    const daysBeaten =
      p.deadlineBeatenDays != null && p.deadlineBeatenDays > 0
        ? p.deadlineBeatenDays
        : completed >= due
          ? null
          : daysBetween(completed, due);
    if (daysBeaten == null || daysBeaten <= 0) continue;
    const athleteId = p.assignedAthlete.id;
    const profile = athleteProfileVisual(p.assignedAthlete);
    const entry = byAthlete.get(athleteId) ?? {
      athleteId,
      athleteName: p.assignedAthlete.fullName,
      ...profile,
      beatenCount: 0,
      totalDaysBeaten: 0,
      averageDaysBeaten: 0,
      projects: [],
    };

    entry.beatenCount += 1;
    entry.totalDaysBeaten += daysBeaten;
    entry.projects.push({
      projectId: p.id,
      projectName: p.name,
      clientName: p.client.name,
      dueDate: due.toISOString().slice(0, 10),
      completedDate: completed.toISOString().slice(0, 10),
      daysBeaten,
    });
    byAthlete.set(athleteId, entry);
  }

  return Array.from(byAthlete.values())
    .map((a) => ({
      ...a,
      averageDaysBeaten:
        a.beatenCount > 0 ? Math.round((a.totalDaysBeaten / a.beatenCount) * 10) / 10 : 0,
      projects: a.projects.sort((x, y) => y.daysBeaten - x.daysBeaten),
    }))
    .sort((a, b) => b.beatenCount - a.beatenCount || b.totalDaysBeaten - a.totalDaysBeaten);
}
