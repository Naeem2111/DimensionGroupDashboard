import type { OpsProjectPhase, OpsProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findDoneColumnId } from "@/lib/planner-completed";
import {
  isClientPortalActiveProject,
  isClientPortalCompletedProject,
} from "@/lib/client-portal-projects";
import { PROJECT_STATUS_LABELS, displayProjectStageLabel } from "@/lib/ops-constants";

export type PublicClientPortalTask = {
  id: string;
  title: string;
  summary: string | null;
  columnTitle: string;
  dueAt: string | null;
  labels: Array<{ name: string; color: string }>;
};

export type PublicClientPortalProject = {
  id: string;
  name: string;
  projectNumber: string;
  address: string | null;
  currentStage: OpsProjectPhase;
  currentStageLabel: string;
  currentStatus: OpsProjectStatus;
  currentStatusLabel: string;
  statusBadge: { label: string; color: string };
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  progressPercent: number;
  leadName: string | null;
  leadPhotoUrl: string | null;
  leadPhotoBgColor: string | null;
  leadPhotoTextTone: string | null;
  openTasks: PublicClientPortalTask[];
  deadlineBeatenDays: number | null;
};

export type PublicClientPortalData = {
  client: {
    name: string;
    companyName: string | null;
    logoUrl: string | null;
    logoBgColor: string | null;
    logoTextTone: string | null;
    activeLaneCount: number;
  };
  activeProjects: PublicClientPortalProject[];
  completedProjects: PublicClientPortalProject[];
};

function clientStatusBadge(
  status: OpsProjectStatus,
  progressPercent: number
): { label: string; color: string } {
  if (status === "completed" && progressPercent < 100) {
    return { label: "On track", color: "#22c55e" };
  }
  switch (status) {
    case "waiting_on_feedback":
      return { label: "In review", color: "#3b82f6" };
    case "zoom_required":
      return { label: "Zoom required", color: "#a855f7" };
    case "in_progress":
      return { label: "On track", color: "#22c55e" };
    case "not_started":
      return { label: "Scheduled", color: "#64748b" };
    case "blocked":
      return { label: "Blocked", color: "#ef4444" };
    case "completed":
      return { label: "Completed", color: "#22c55e" };
    case "handed_over":
      return { label: "Handed over", color: "#64748b" };
    default:
      return { label: PROJECT_STATUS_LABELS[status], color: "#64748b" };
  }
}

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function mapProject(
  p: {
    id: string;
    name: string;
    projectNumber: string;
    address: string | null;
    projectLead: string | null;
    currentStage: OpsProjectPhase;
    currentStatus: OpsProjectStatus;
    startDate: Date | null;
    dueDate: Date | null;
    handoverDate: Date | null;
    progressPercent: number | null;
    deadlineBeatenDays: number | null;
    projectLeadContact: {
      name: string;
      email: string | null;
    } | null;
    projectLeadAthlete: {
      fullName: string;
      profilePhotoUrl: string | null;
      profilePhotoBgColor: string | null;
      profilePhotoTextTone: string | null;
    } | null;
  },
  openTasks: PublicClientPortalTask[]
): PublicClientPortalProject {
  const progressPercent = p.progressPercent ?? 0;
  const contact = p.projectLeadContact;
  const legacyAthlete = p.projectLeadAthlete;
  return {
    id: p.id,
    name: p.name,
    projectNumber: p.projectNumber,
    address: p.address,
    currentStage: p.currentStage,
    currentStageLabel: displayProjectStageLabel(p.currentStage),
    currentStatus: p.currentStatus,
    currentStatusLabel: PROJECT_STATUS_LABELS[p.currentStatus],
    statusBadge: clientStatusBadge(p.currentStatus, progressPercent),
    startDate: isoDate(p.startDate),
    dueDate: isoDate(p.dueDate),
    handoverDate: isoDate(p.handoverDate),
    progressPercent,
    leadName: contact?.name ?? legacyAthlete?.fullName ?? p.projectLead ?? null,
    leadPhotoUrl: contact ? null : legacyAthlete?.profilePhotoUrl ?? null,
    leadPhotoBgColor: contact ? null : legacyAthlete?.profilePhotoBgColor ?? null,
    leadPhotoTextTone: contact ? null : legacyAthlete?.profilePhotoTextTone ?? null,
    openTasks,
    deadlineBeatenDays: p.deadlineBeatenDays,
  };
}

export async function getPublicClientPortal(clientSlug: string): Promise<PublicClientPortalData | null> {
  const decoded = decodeURIComponent(clientSlug).trim().toLowerCase();
  const client = await prisma.opsClient.findFirst({
    where: {
      slug: decoded,
      publicPortalEnabled: true,
      status: "active",
    },
    include: {
      commercial: { select: { activeLaneCount: true } },
    },
  });
  if (!client) return null;

  const projects = await prisma.opsProject.findMany({
    where: { clientId: client.id },
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    include: {
      projectLeadContact: { select: { name: true, email: true } },
      projectLeadAthlete: {
        select: {
          fullName: true,
          profilePhotoUrl: true,
          profilePhotoBgColor: true,
          profilePhotoTextTone: true,
        },
      },
    },
  });

  const allProjectIds = projects.map((p) => p.id);
  const boards = await prisma.plannerBoard.findMany({
    where: { kind: "project", opsProjectId: { in: allProjectIds } },
    include: {
      columns: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
    },
  });

  const tasksByProjectId = new Map<string, PublicClientPortalTask[]>();

  for (const board of boards) {
    if (!board.opsProjectId) continue;
    const doneColId = findDoneColumnId(board.columns);
    const tasks = await prisma.plannerTask.findMany({
      where: {
        column: { boardId: board.id },
        linkedFromTaskId: null,
        ...(doneColId ? { columnId: { not: doneColId } } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        summary: true,
        dueAt: true,
        column: { select: { title: true } },
        labels: {
          include: { label: { select: { name: true, color: true } } },
        },
      },
    });

    tasksByProjectId.set(
      board.opsProjectId,
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        summary: t.summary,
        columnTitle: t.column.title,
        dueAt: t.dueAt?.toISOString() ?? null,
        labels: t.labels.map((l) => ({ name: l.label.name, color: l.label.color })),
      }))
    );
  }

  const mapped = projects.map((p) => mapProject(p, tasksByProjectId.get(p.id) ?? []));

  return {
    client: {
      name: client.name,
      companyName: client.companyName,
      logoUrl: client.logoUrl,
      logoBgColor: client.logoBgColor,
      logoTextTone: client.logoTextTone,
      activeLaneCount: client.commercial?.activeLaneCount ?? 1,
    },
    activeProjects: mapped.filter(isClientPortalActiveProject),
    completedProjects: mapped.filter(isClientPortalCompletedProject),
  };
}
