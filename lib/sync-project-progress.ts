import { prisma } from "@/lib/prisma";
import { dateOnlyUtc } from "@/lib/ops-hours";
import {
  computeDeadlineBeatenDays,
  projectCompletionDate,
} from "@/lib/project-completion";
import {
  isActiveProjectStatus,
  syncProjectAfterOpsUpdate,
} from "@/lib/planner-project-sync";

/** Progress when a completed project is moved back to active work. */
export const REACTIVATION_PROGRESS_PERCENT = 90;

type LatestCompletionLog = {
  progressPercent: number;
  submissionDate: Date;
  isBackloggedSession: boolean;
};

async function latestCompletionLogForProject(
  projectId: string
): Promise<LatestCompletionLog | null> {
  const latest = await prisma.opsSubmissionLineItem.findFirst({
    where: { projectId, completionPercent: { not: null } },
    orderBy: [{ submission: { submissionDate: "desc" } }, { submission: { updatedAt: "desc" } }],
    select: {
      completionPercent: true,
      submission: {
        select: {
          submissionDate: true,
          isBackloggedSession: true,
        },
      },
    },
  });
  if (!latest || latest.completionPercent == null) return null;
  return {
    progressPercent: Math.max(0, Math.min(100, Math.round(Number(latest.completionPercent)))),
    submissionDate: latest.submission.submissionDate,
    isBackloggedSession: latest.submission.isBackloggedSession,
  };
}

/** When a backlogged log marks 100%, use that session date so deadlines reflect actual work timing. */
export function resolveCompletedAtFromLog(log: LatestCompletionLog | null): Date {
  if (!log || log.progressPercent < 100) return projectCompletionDate();
  if (log.isBackloggedSession) return dateOnlyUtc(log.submissionDate);
  return projectCompletionDate();
}

function completionMetrics(
  dueDate: Date | null,
  log: LatestCompletionLog | null
): { completedAt: Date; deadlineBeatenDays: number | null } {
  const completedAt = resolveCompletedAtFromLog(log);
  const deadlineBeatenDays =
    dueDate && log && log.progressPercent >= 100
      ? computeDeadlineBeatenDays(dueDate, completedAt)
      : null;
  return { completedAt, deadlineBeatenDays };
}

/** Recalculate project progress from all daily log line items and sync completion state. */
export async function syncProjectProgressForProjects(projectIds: string[]) {
  const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
  for (const projectId of uniqueIds) {
    const before = await prisma.opsProject.findUnique({
      where: { id: projectId },
      select: {
        assignedAthleteId: true,
        currentStatus: true,
        name: true,
        progressPercent: true,
        dueDate: true,
      },
    });
    if (!before) continue;

    const latestLog = await latestCompletionLogForProject(projectId);
    const progressPercent =
      latestLog?.progressPercent ?? before.progressPercent ?? 0;

    const wasCompleted =
      before.currentStatus === "completed" || before.currentStatus === "handed_over";

    if (progressPercent >= 100 && isActiveProjectStatus(before.currentStatus) && before.assignedAthleteId) {
      const { completedAt, deadlineBeatenDays } = completionMetrics(before.dueDate, latestLog);

      const completed = await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent: 100,
          currentStatus: "completed",
          completedAt,
          deadlineBeatenDays,
        },
        select: {
          assignedAthleteId: true,
          currentStatus: true,
          name: true,
        },
      });

      await syncProjectAfterOpsUpdate(
        projectId,
        {
          assignedAthleteId: before.assignedAthleteId,
          currentStatus: before.currentStatus,
          name: before.name,
        },
        {
          assignedAthleteId: completed.assignedAthleteId,
          currentStatus: completed.currentStatus,
          name: completed.name,
        }
      );
      continue;
    }

    if (wasCompleted && progressPercent >= 100) {
      const { completedAt, deadlineBeatenDays } = completionMetrics(before.dueDate, latestLog);
      await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent,
          completedAt,
          deadlineBeatenDays,
        },
      });
      continue;
    }

    if (wasCompleted && progressPercent < 100) {
      const reactivated = await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent,
          currentStatus: "in_progress",
          completedAt: null,
          deadlineBeatenDays: null,
        },
        select: {
          assignedAthleteId: true,
          currentStatus: true,
          name: true,
        },
      });

      await syncProjectAfterOpsUpdate(
        projectId,
        {
          assignedAthleteId: before.assignedAthleteId,
          currentStatus: before.currentStatus,
          name: before.name,
        },
        {
          assignedAthleteId: reactivated.assignedAthleteId,
          currentStatus: reactivated.currentStatus,
          name: reactivated.name,
        }
      );
      continue;
    }

    await prisma.opsProject.update({
      where: { id: projectId },
      data: { progressPercent },
    });
  }
}

/** @deprecated Prefer syncProjectProgressForProjects after persisting line items. */
export async function syncProjectProgressFromLineItems(
  lineItems: Array<{ projectId: string; completionPercent?: number | null }>
) {
  await syncProjectProgressForProjects(lineItems.map((li) => li.projectId));
}
