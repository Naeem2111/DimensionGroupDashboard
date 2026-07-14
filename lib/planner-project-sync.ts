import type { OpsProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAthleteSystemBoards, ensureProjectBoard } from "@/lib/planner-system-boards";
import { createAthleteNotification } from "@/lib/ops-athlete-notifications";

const INACTIVE_PROJECT_STATUSES: OpsProjectStatus[] = ["completed", "handed_over"];

export function isActiveProjectStatus(status: OpsProjectStatus): boolean {
  return !INACTIVE_PROJECT_STATUSES.includes(status);
}

/** Ensure Kanban project board exists when an athlete is assigned. */
export async function syncProjectBoardOnAssign(projectId: string) {
  const project = await prisma.opsProject.findUnique({
    where: { id: projectId },
    include: {
      assignedAthlete: { select: { id: true, userId: true } },
    },
  });
  if (!project?.assignedAthleteId || !project.assignedAthlete) return;

  const { assignedAthlete: athlete } = project;
  await ensureAthleteSystemBoards(athlete.id, athlete.userId);

  if (!isActiveProjectStatus(project.currentStatus)) return;

  await ensureProjectBoard(athlete.id, athlete.userId, project.id, project.name);
}

/** Update project board title when project is renamed. */
export async function syncProjectBoardTitle(projectId: string, name: string) {
  await prisma.plannerBoard.updateMany({
    where: { opsProjectId: projectId, kind: "project" },
    data: { title: name },
  });
}

/** After assignment or status change. */
export async function syncProjectAfterOpsUpdate(
  projectId: string,
  prev: { assignedAthleteId: string | null; currentStatus: OpsProjectStatus; name: string },
  next: { assignedAthleteId: string | null; currentStatus: OpsProjectStatus; name: string }
) {
  if (next.name !== prev.name) {
    await syncProjectBoardTitle(projectId, next.name);
  }

  if (next.assignedAthleteId && next.assignedAthleteId !== prev.assignedAthleteId) {
    await syncProjectBoardOnAssign(projectId);
  } else if (next.assignedAthleteId && isActiveProjectStatus(next.currentStatus)) {
    await syncProjectBoardOnAssign(projectId);
  }

  const wasActive = isActiveProjectStatus(prev.currentStatus);
  const nowInactive = !isActiveProjectStatus(next.currentStatus);
  if (wasActive && nowInactive && next.assignedAthleteId) {
    await createAthleteNotification({
      athleteId: next.assignedAthleteId,
      type: "project_completed",
      title: `Project completed: ${next.name}`,
      message: "This project has moved to your Completed Projects list.",
      linkPath: "/dashboard/athlete/projects/completed",
    }).catch(() => {});
  }

  const wasInactive = !isActiveProjectStatus(prev.currentStatus);
  const nowActive = isActiveProjectStatus(next.currentStatus);
  if (wasInactive && nowActive && next.assignedAthleteId) {
    await syncProjectBoardOnAssign(projectId);
  }
}
