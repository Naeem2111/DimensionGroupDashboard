import type { OpsProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { athleteProfileVisual } from "@/lib/athlete-profile-visual";
import { findDoneColumnId } from "@/lib/planner-completed";
import { projectDisplayFields } from "@/lib/project-display";

export type OpsArchivesFilters = {
  clientId?: string;
  athleteId?: string;
};

const COMPLETED_PROJECT_STATUSES: OpsProjectStatus[] = ["completed", "handed_over"];

function assigneeLabel(assignee: {
  username: string;
  opsAthleteProfile: { fullName: string } | null;
} | null): string | null {
  if (!assignee) return null;
  return assignee.opsAthleteProfile?.fullName ?? assignee.username;
}

export async function buildOpsArchives(filters: OpsArchivesFilters = {}) {
  const { clientId, athleteId } = filters;

  const projectWhere = {
    currentStatus: { in: COMPLETED_PROJECT_STATUSES },
    ...(clientId ? { clientId } : {}),
    ...(athleteId ? { assignedAthleteId: athleteId } : {}),
  };

  const [projects, boards, clients, athletes] = await Promise.all([
    prisma.opsProject.findMany({
      where: projectWhere,
      orderBy: [{ completedAt: "desc" }, { handoverDate: "desc" }, { updatedAt: "desc" }],
      include: {
        client: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            logoBgColor: true,
            logoTextTone: true,
          },
        },
        assignedAthlete: {
          select: {
            id: true,
            fullName: true,
            athleteCode: true,
            profilePhotoUrl: true,
            profilePhotoBgColor: true,
            profilePhotoTextTone: true,
          },
        },
      },
    }),
    prisma.plannerBoard.findMany({
      where: {
        OR: [{ athleteId: { not: null } }, { opsProjectId: { not: null } }],
        ...(athleteId ? { athleteId } : {}),
        ...(clientId ? { opsProject: { clientId } } : {}),
      },
      select: {
        id: true,
        title: true,
        athleteId: true,
        opsProjectId: true,
        athlete: {
          select: {
            id: true,
            fullName: true,
            athleteCode: true,
            profilePhotoUrl: true,
            profilePhotoBgColor: true,
            profilePhotoTextTone: true,
          },
        },
        opsProject: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            clientId: true,
            assignedAthleteId: true,
            client: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                logoBgColor: true,
                logoTextTone: true,
              },
            },
            assignedAthlete: { select: { id: true, fullName: true, athleteCode: true, profilePhotoUrl: true, profilePhotoBgColor: true, profilePhotoTextTone: true } },
          },
        },
        columns: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
      },
    }),
    prisma.opsClient.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.opsAthlete.findMany({
      where: { status: "active" },
      select: { id: true, fullName: true, athleteCode: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  type BoardContext = {
    boardId: string;
    boardTitle: string;
    athleteId: string | null;
    athleteName: string | null;
    athleteCode: string | null;
    profilePhotoUrl: string | null;
    profilePhotoBgColor: string | null;
    profilePhotoTextTone: string | null;
    projectId: string | null;
    projectName: string | null;
    projectNumber: string | null;
    clientId: string | null;
    clientName: string | null;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
  };

  const columnContext = new Map<string, BoardContext>();
  const doneColumnIds: string[] = [];

  for (const board of boards) {
    const doneId = findDoneColumnId(board.columns);
    if (!doneId) continue;
    doneColumnIds.push(doneId);
    const project = board.opsProject;
    const boardAthlete = board.athlete ?? project?.assignedAthlete ?? null;
    const athleteVisual = athleteProfileVisual(boardAthlete);
    columnContext.set(doneId, {
      boardId: board.id,
      boardTitle: board.title,
      athleteId: boardAthlete?.id ?? null,
      athleteName: boardAthlete?.fullName ?? null,
      athleteCode: boardAthlete?.athleteCode ?? null,
      ...athleteVisual,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      projectNumber: project?.projectNumber ?? null,
      clientId: project?.clientId ?? null,
      clientName: project?.client.name ?? null,
      clientLogoUrl: project?.client.logoUrl ?? null,
      clientLogoBgColor: project?.client.logoBgColor ?? null,
      clientLogoTextTone: project?.client.logoTextTone ?? null,
    });
  }

  const rawTasks =
    doneColumnIds.length === 0
      ? []
      : await prisma.plannerTask.findMany({
          where: {
            columnId: { in: doneColumnIds },
            linkedFromTaskId: null,
          },
          orderBy: { updatedAt: "desc" },
          take: 500,
          include: {
            assignee: {
              select: {
                username: true,
                opsAthleteProfile: {
                  select: {
                    id: true,
                    fullName: true,
                    athleteCode: true,
                    profilePhotoUrl: true,
                    profilePhotoBgColor: true,
                    profilePhotoTextTone: true,
                  },
                },
              },
            },
            column: { select: { id: true } },
          },
        });

  const tasks = rawTasks
    .map((task) => {
      const ctx = columnContext.get(task.columnId);
      if (!ctx) return null;
      if (athleteId && ctx.athleteId !== athleteId) return null;
      if (clientId && ctx.clientId !== clientId) return null;

      const completedBy =
        assigneeLabel(task.assignee) ?? ctx.athleteName ?? "Unassigned";
      const completedByAthleteId =
        task.assignee?.opsAthleteProfile?.id ?? ctx.athleteId ?? null;
      const completedByProfile = task.assignee?.opsAthleteProfile
        ? athleteProfileVisual(task.assignee.opsAthleteProfile)
        : {
            profilePhotoUrl: ctx.profilePhotoUrl,
            profilePhotoBgColor: ctx.profilePhotoBgColor,
            profilePhotoTextTone: ctx.profilePhotoTextTone,
          };

      return {
        id: task.id,
        title: task.title,
        summary: task.summary,
        completedAt: task.updatedAt.toISOString(),
        completedBy,
        completedByAthleteId,
        ...completedByProfile,
        boardId: ctx.boardId,
        boardTitle: ctx.boardTitle,
        projectId: ctx.projectId,
        projectName: ctx.projectName,
        projectNumber: ctx.projectNumber,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
        clientLogoUrl: ctx.clientLogoUrl,
        clientLogoBgColor: ctx.clientLogoBgColor,
        clientLogoTextTone: ctx.clientLogoTextTone,
        athleteId: ctx.athleteId,
        athleteName: ctx.athleteName,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null);

  const lineItems = await prisma.opsSubmissionLineItem.findMany({
    where: {
      completionPercent: { gte: 100 },
      ...(clientId ? { clientId } : {}),
      ...(athleteId ? { submission: { athleteId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      submission: {
        select: {
          submissionDate: true,
          athlete: { select: { id: true, fullName: true, athleteCode: true, profilePhotoUrl: true, profilePhotoBgColor: true, profilePhotoTextTone: true } },
        },
      },
      project: { select: { id: true, name: true, projectNumber: true } },
      client: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          logoBgColor: true,
          logoTextTone: true,
        },
      },
    },
  });

  return {
    filters: { clientId: clientId ?? null, athleteId: athleteId ?? null },
    filterOptions: {
      clients,
      athletes,
    },
    projects: projects.map((p) => {
      const { displayTitle, stageLabel } = projectDisplayFields(p);
      return {
      id: p.id,
      name: p.name,
      displayTitle,
      stageLabel,
      address: p.address,
      projectNumber: p.projectNumber,
      clientId: p.clientId,
      clientName: p.client.name,
      clientLogoUrl: p.client.logoUrl,
      clientLogoBgColor: p.client.logoBgColor,
      clientLogoTextTone: p.client.logoTextTone,
      assignedAthleteId: p.assignedAthleteId,
      assignedAthleteName: p.assignedAthlete?.fullName ?? null,
      assignedAthleteCode: p.assignedAthlete?.athleteCode ?? null,
      ...athleteProfileVisual(p.assignedAthlete),
      currentStatus: p.currentStatus,
      currentStage: p.currentStage,
      complexity: p.complexity,
      progressPercent: p.progressPercent,
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      handoverDate: p.handoverDate?.toISOString().slice(0, 10) ?? null,
      completedAt: p.completedAt?.toISOString().slice(0, 10) ?? null,
      deadlineBeatenDays: p.deadlineBeatenDays,
      updatedAt: p.updatedAt.toISOString(),
    };
    }),
    tasks,
    loggedCompletions: lineItems.map((li) => ({
      id: li.id,
      submissionDate: li.submission.submissionDate.toISOString().slice(0, 10),
      athleteId: li.submission.athlete.id,
      athleteName: li.submission.athlete.fullName,
      athleteCode: li.submission.athlete.athleteCode,
      ...athleteProfileVisual(li.submission.athlete),
      clientId: li.clientId,
      clientName: li.client.name,
      clientLogoUrl: li.client.logoUrl,
      clientLogoBgColor: li.client.logoBgColor,
      clientLogoTextTone: li.client.logoTextTone,
      projectId: li.projectId,
      isHousekeeping: li.isHousekeeping,
      projectName: li.isHousekeeping || !li.project ? "Client housekeeping" : li.project.name,
      projectNumber: li.isHousekeeping || !li.project ? "—" : li.project.projectNumber,
      projectPhase: li.projectPhase,
      taskType: li.taskType,
      taskTypes: li.taskTypes,
      hoursWorked: Number(li.hoursWorked),
      completionPercent: li.completionPercent,
      completedSummary: li.completedSummary,
      loggedAt: li.createdAt.toISOString(),
    })),
  };
}
