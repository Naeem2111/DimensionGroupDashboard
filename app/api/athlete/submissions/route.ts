import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpsUrgencyStatus } from "@prisma/client";
import {
  athleteMonthlySummary,
  requireAthletePortalSession,
} from "@/lib/ops-access";
import { computeMonthlyHoursSummary, dateOnlyUtc, parseDateOnly } from "@/lib/ops-hours";
import { buildDailyHourAlerts, isSubmissionEditable } from "@/lib/ops-alerts";
import { lockStaleSubmissions } from "@/lib/ops-commercial";
import { parseSubmissionLineItems } from "@/lib/ops-submission-mutate";
import { syncProjectProgressForProjects } from "@/lib/sync-project-progress";
import { projectDisplayFields } from "@/lib/project-display";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  await lockStaleSubmissions(athlete.id);

  // Clear legacy auto-locks (submission locks feature disabled)
  await prisma.opsDailySubmission.updateMany({
    where: { athleteId: athlete.id, lockedAt: { not: null } },
    data: { lockedAt: null },
  });

  const submissions = await prisma.opsDailySubmission.findMany({
    where: { athleteId: athlete.id },
    orderBy: { submissionDate: "desc" },
    take: 60,
    include: {
      lineItems: {
        include: {
          project: { select: { name: true, projectNumber: true, currentStage: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    monthlyHourCap: athlete.monthlyHourCap,
    submissions: submissions.map((s) => ({
      id: s.id,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      wellbeingScore: s.wellbeingScore,
      checkInRequested: s.checkInRequested,
      dailyNote: s.dailyNote,
      isBackloggedSession: s.isBackloggedSession,
      totalHours: Number(s.totalHours),
      lockedAt: s.lockedAt?.toISOString() ?? null,
      editable: isSubmissionEditable(s.submissionDate, s.lockedAt),
      alerts: buildDailyHourAlerts(Number(s.totalHours)),
      lineItems: s.lineItems.map((li) => {
        if (li.isHousekeeping || !li.project) {
          return {
            id: li.id,
            clientId: li.clientId,
            projectId: li.projectId,
            isHousekeeping: true,
            clientName: li.client.name,
            projectName: "Client housekeeping",
            projectDisplayTitle: "Client housekeeping",
            projectNumber: "—",
            projectPhase: li.projectPhase,
            taskType: li.taskType,
            taskTypes: li.taskTypes?.length ? li.taskTypes : [li.taskType],
            hoursWorked: Number(li.hoursWorked),
            completedSummary: li.completedSummary,
            completionPercent: li.completionPercent,
            notes: li.notes,
          };
        }
        const { displayTitle } = projectDisplayFields(li.project);
        return {
          id: li.id,
          clientId: li.clientId,
          projectId: li.projectId,
          isHousekeeping: false,
          clientName: li.client.name,
          projectName: li.project.name,
          projectDisplayTitle: displayTitle,
          projectNumber: li.project.projectNumber,
          projectPhase: li.projectPhase,
          taskType: li.taskType,
          taskTypes: li.taskTypes?.length ? li.taskTypes : [li.taskType],
          hoursWorked: Number(li.hoursWorked),
          completedSummary: li.completedSummary,
          completionPercent: li.completionPercent,
          notes: li.notes,
        };
      }),
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  try {
    const body = await request.json();
    const dateRaw = body.submissionDate ? String(body.submissionDate) : "";
    const submissionDate = parseDateOnly(dateRaw) ?? dateOnlyUtc(new Date());
    const lineItems = parseSubmissionLineItems(body.lineItems);
    const isBackloggedSession = Boolean(body.isBackloggedSession);

    if (!lineItems) {
      return NextResponse.json({ error: "At least one valid project entry is required" }, { status: 400 });
    }

    for (const li of lineItems) {
      if (li.taskTypes.includes("other") && !li.notes?.trim()) {
        return NextResponse.json(
          { error: "Please specify what “Other” task type means for each entry that uses it" },
          { status: 400 }
        );
      }
    }

    await lockStaleSubmissions(athlete.id);

    const existing = await prisma.opsDailySubmission.findUnique({
      where: {
        athleteId_submissionDate: { athleteId: athlete.id, submissionDate },
      },
    });
    if (existing?.lockedAt) {
      return NextResponse.json(
        { error: "This submission is locked — ask admin to unlock under Ops → Submissions" },
        { status: 400 }
      );
    }

    for (const li of lineItems) {
      if (li.isHousekeeping) {
        const link = await prisma.opsProject.findFirst({
          where: { assignedAthleteId: athlete.id, clientId: li.clientId },
        });
        if (!link) {
          return NextResponse.json({ error: "Invalid client for housekeeping entry" }, { status: 400 });
        }
        continue;
      }
      const project = await prisma.opsProject.findFirst({
        where: { id: li.projectId!, assignedAthleteId: athlete.id, clientId: li.clientId },
      });
      if (!project) {
        return NextResponse.json({ error: "Invalid project selection" }, { status: 400 });
      }
    }

    const totalHours = lineItems.reduce((sum, li) => sum + li.hoursWorked, 0);
    const wellbeingScore =
      body.wellbeingScore != null ? Math.max(1, Math.min(10, Number(body.wellbeingScore))) : null;

    const submission = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.opsSubmissionLineItem.deleteMany({ where: { submissionId: existing.id } });
        await tx.opsDailySubmission.update({
          where: { id: existing.id },
          data: {
            wellbeingScore,
            checkInRequested: Boolean(body.checkInRequested),
            dailyNote: body.dailyNote ? String(body.dailyNote).trim() : null,
            isBackloggedSession,
            totalHours,
            lockedAt: null,
          },
        });
        await tx.opsSubmissionLineItem.createMany({
          data: lineItems.map((li) => ({
            submissionId: existing.id,
            clientId: li.clientId,
            projectId: li.projectId,
            isHousekeeping: li.isHousekeeping,
            projectPhase: li.projectPhase,
            taskType: li.taskType,
            taskTypes: li.taskTypes,
            hoursWorked: li.hoursWorked,
            completionPercent: li.completionPercent ?? null,
            urgencyStatus: (li.urgencyStatus ?? "normal") as OpsUrgencyStatus,
            completedSummary: li.completedSummary,
            notes: li.notes,
          })),
        });
        return tx.opsDailySubmission.findUniqueOrThrow({
          where: { id: existing.id },
          include: { lineItems: true },
        });
      }

      const created = await tx.opsDailySubmission.create({
        data: {
          athleteId: athlete.id,
          submissionDate,
          wellbeingScore,
          checkInRequested: Boolean(body.checkInRequested),
          dailyNote: body.dailyNote ? String(body.dailyNote).trim() : null,
          isBackloggedSession,
          totalHours,
          lineItems: {
            create: lineItems.map((li) => ({
              clientId: li.clientId,
              projectId: li.projectId,
              isHousekeeping: li.isHousekeeping,
              projectPhase: li.projectPhase,
              taskType: li.taskType,
              taskTypes: li.taskTypes,
              hoursWorked: li.hoursWorked,
              completionPercent: li.completionPercent ?? null,
              urgencyStatus: (li.urgencyStatus ?? "normal") as OpsUrgencyStatus,
              completedSummary: li.completedSummary,
              notes: li.notes,
            })),
          },
        },
        include: { lineItems: true },
      });

      if (body.checkInRequested) {
        const projectIds = lineItems.map((li) => li.projectId).filter((id): id is string => !!id);
        if (projectIds.length > 0) {
          await tx.opsProject.updateMany({
            where: { id: { in: projectIds } },
            data: { checkInRequested: true },
          });
        }
      }

      return created;
    });

    await syncProjectProgressForProjects(
      lineItems.map((li) => li.projectId).filter((id): id is string => !!id)
    ).catch((err) => {
      console.error("Failed to sync project progress from daily log", err);
    });

    const monthSummary = await athleteMonthlySummary(athlete);
    const todayHours = Number(submission.totalHours);
    const preview = computeMonthlyHoursSummary({
      monthHours: monthSummary.monthHours,
      monthlyHourCap: athlete.monthlyHourCap,
      baseMonthlyPayZar: Number(athlete.baseMonthlyPayZar),
      overtimeRateZar: Number(athlete.overtimeRateZar),
    });

    return NextResponse.json(
      {
        submission: {
          id: submission.id,
          submissionDate: submission.submissionDate.toISOString().slice(0, 10),
          totalHours: Number(submission.totalHours),
          isBackloggedSession: submission.isBackloggedSession,
        },
        calculation: {
          todayHours,
          monthHoursBefore: monthSummary.monthHours - todayHours,
          monthHoursAfter: preview.monthHours,
          hoursRemaining: preview.hoursRemaining,
          overtimeTriggered: preview.overtimeTriggered,
          overtimeHours: preview.monthOvertimeHours,
          totalEarningsZar: preview.totalEarningsZar,
          alerts: buildDailyHourAlerts(todayHours),
        },
      },
      { status: existing ? 200 : 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
