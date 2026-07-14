import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpsUrgencyStatus } from "@prisma/client";
import { requireOpsSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { parseSubmissionLineItems } from "@/lib/ops-submission-mutate";
import { syncProjectProgressForProjects } from "@/lib/sync-project-progress";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsDailySubmission.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!existing) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  try {
    const body = await request.json();
    const unlock = body.unlock === true;
    const lock = body.lock === true;

    if (unlock || lock) {
      if (unlock && lock) {
        return NextResponse.json({ error: "Specify unlock or lock, not both" }, { status: 400 });
      }
      const updated = await prisma.opsDailySubmission.update({
        where: { id },
        data: unlock
          ? { lockedAt: null, adminUnlockedAt: new Date() }
          : { lockedAt: new Date(), adminUnlockedAt: null },
      });
      return NextResponse.json({
        submission: {
          id: updated.id,
          submissionDate: updated.submissionDate.toISOString().slice(0, 10),
          lockedAt: updated.lockedAt?.toISOString() ?? null,
        },
      });
    }

    const lineItems = body.lineItems != null ? parseSubmissionLineItems(body.lineItems) : null;
    if (body.lineItems != null && !lineItems) {
      return NextResponse.json({ error: "Invalid line items" }, { status: 400 });
    }

    const submissionDate =
      body.submissionDate != null
        ? parseDateOnly(String(body.submissionDate))
        : existing.submissionDate;
    if (!submissionDate) {
      return NextResponse.json({ error: "Invalid submission date" }, { status: 400 });
    }

    const wellbeingScore =
      body.wellbeingScore != null ? Math.max(1, Math.min(10, Number(body.wellbeingScore))) : existing.wellbeingScore;
    const isBackloggedSession =
      body.isBackloggedSession !== undefined ? Boolean(body.isBackloggedSession) : existing.isBackloggedSession;
    const dailyNote =
      body.dailyNote !== undefined
        ? body.dailyNote
          ? String(body.dailyNote).trim()
          : null
        : existing.dailyNote;
    const checkInRequested =
      body.checkInRequested !== undefined ? Boolean(body.checkInRequested) : existing.checkInRequested;

    const nextLineItems = lineItems ?? existing.lineItems.map((li) => ({
      clientId: li.clientId,
      projectId: li.projectId,
      isHousekeeping: li.isHousekeeping,
      projectPhase: li.projectPhase,
      taskType: li.taskType,
      taskTypes: li.taskTypes?.length ? li.taskTypes : [li.taskType],
      hoursWorked: Number(li.hoursWorked),
      completionPercent: li.completionPercent,
      urgencyStatus: li.urgencyStatus,
      completedSummary: li.completedSummary,
      notes: li.notes,
    }));

    for (const li of nextLineItems) {
      if (li.isHousekeeping) continue;
      if (!li.projectId) {
        return NextResponse.json({ error: "Invalid project on line item" }, { status: 400 });
      }
      const project = await prisma.opsProject.findFirst({
        where: { id: li.projectId, clientId: li.clientId },
      });
      if (!project) {
        return NextResponse.json({ error: "Invalid project on line item" }, { status: 400 });
      }
    }

    const totalHours = nextLineItems.reduce((sum, li) => sum + li.hoursWorked, 0);

    const updated = await prisma.$transaction(async (tx) => {
      if (submissionDate.getTime() !== existing.submissionDate.getTime()) {
        const conflict = await tx.opsDailySubmission.findUnique({
          where: {
            athleteId_submissionDate: {
              athleteId: existing.athleteId,
              submissionDate,
            },
          },
        });
        if (conflict && conflict.id !== existing.id) {
          throw new Error("DATE_CONFLICT");
        }
      }

      await tx.opsSubmissionLineItem.deleteMany({ where: { submissionId: existing.id } });
      const row = await tx.opsDailySubmission.update({
        where: { id: existing.id },
        data: {
          submissionDate,
          wellbeingScore,
          checkInRequested,
          dailyNote,
          isBackloggedSession,
          totalHours,
          lockedAt: null,
          adminUnlockedAt: new Date(),
        },
      });
      await tx.opsSubmissionLineItem.createMany({
        data: nextLineItems.map((li) => ({
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
      return row;
    });

    await syncProjectProgressForProjects(
      nextLineItems.map((li) => li.projectId).filter((id): id is string => !!id)
    ).catch(() => {});

    return NextResponse.json({
      submission: {
        id: updated.id,
        submissionDate: updated.submissionDate.toISOString().slice(0, 10),
        totalHours: Number(updated.totalHours),
        isBackloggedSession: updated.isBackloggedSession,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DATE_CONFLICT") {
      return NextResponse.json({ error: "Another submission already exists for that date" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
