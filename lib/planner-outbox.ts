import type { OpsOutboxPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAthleteNotification } from "@/lib/ops-athlete-notifications";
import { isApprovedLabelName } from "@/lib/planner-approved-labels";
import { ensureDefaultLabelsOnBoard } from "@/lib/planner-labels-seed";
import { ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

function buildInboxDescription(input: {
  description: string | null;
  notes: string | null;
  projectName: string | null;
  clientName: string | null;
  labelName: string | null;
  dueAt: Date | null;
  attachments: unknown;
}): string {
  const parts: string[] = [];
  if (input.description?.trim()) parts.push(input.description.trim());
  const meta: string[] = [];
  if (input.projectName) {
    meta.push(`Project: ${input.projectName}${input.clientName ? ` (${input.clientName})` : ""}`);
  }
  if (input.labelName) meta.push(`Label: ${input.labelName}`);
  if (input.dueAt) {
    meta.push(`Due: ${input.dueAt.toISOString().slice(0, 10)}`);
  }
  if (input.notes?.trim()) meta.push(`Notes: ${input.notes.trim()}`);
  if (input.attachments) {
    meta.push(`Attachments: ${JSON.stringify(input.attachments)}`);
  }
  if (meta.length) parts.push(meta.join("\n"));
  return parts.join("\n\n") || "Assigned from Blocharch Outbox";
}

async function attachLabelToTask(boardId: string, taskId: string, labelName: string | null) {
  if (!labelName || !isApprovedLabelName(labelName)) return;
  await ensureDefaultLabelsOnBoard(boardId);
  const label = await prisma.plannerLabel.findFirst({
    where: { boardId, name: labelName },
    select: { id: true },
  });
  if (!label) return;
  const existing = await prisma.plannerTaskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });
  if (!existing) {
    await prisma.plannerTaskLabel.create({
      data: { taskId, labelId: label.id },
    });
  }
}

/** Creates a card on the athlete Blocharch Inbox and marks the outbox row delivered. */
export async function deliverOutboxTaskToInbox(outboxTaskId: string) {
  const row = await prisma.opsOutboxTask.findUnique({
    where: { id: outboxTaskId },
    include: {
      athlete: { select: { id: true, userId: true, fullName: true } },
      project: { include: { client: { select: { name: true } } } },
    },
  });
  if (!row) throw new Error("Outbox task not found");

  if (row.inboxTaskId) {
    const stillThere = await prisma.plannerTask.findUnique({
      where: { id: row.inboxTaskId },
      select: { id: true },
    });
    if (stillThere) {
      if (!row.deliveredAt) {
        await prisma.opsOutboxTask.update({
          where: { id: row.id },
          data: { deliveredAt: new Date() },
        });
      }
      return { taskId: row.inboxTaskId, alreadyDelivered: true };
    }
  }

  const athlete = row.athlete;
  await ensureAthleteSystemBoards(athlete.id, athlete.userId);

  const inboxBoard = await prisma.plannerBoard.findFirst({
    where: { athleteId: athlete.id, kind: "blocharch_inbox" },
    select: { id: true },
  });
  if (!inboxBoard) throw new Error("Athlete Inbox board missing");

  const backlog = await prisma.plannerColumn.findFirst({
    where: { boardId: inboxBoard.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!backlog) throw new Error("Inbox board has no columns");

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: backlog.id },
    _max: { sortOrder: true },
  });

  const title =
    (row.title?.trim() || "Assigned task").slice(0, 200);
  const description = buildInboxDescription({
    description: row.description,
    notes: row.notes,
    projectName: row.project?.name ?? null,
    clientName: row.project?.client?.name ?? null,
    labelName: row.labelName,
    dueAt: row.dueAt,
    attachments: row.attachments,
  });

  const task = await prisma.plannerTask.create({
    data: {
      columnId: backlog.id,
      title,
      description,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      dueAt: row.dueAt,
      customFields: {
        outboxTaskId: row.id,
        source: "blocharch_outbox",
        labelName: row.labelName,
      },
    },
  });

  if (row.labelName) {
    await attachLabelToTask(inboxBoard.id, task.id, row.labelName);
  }

  await prisma.opsOutboxTask.update({
    where: { id: row.id },
    data: {
      inboxBoardId: inboxBoard.id,
      inboxTaskId: task.id,
      deliveredAt: new Date(),
    },
  });

  await createAthleteNotification({
    athleteId: athlete.id,
    type: "task_assigned",
    title: title,
    message: row.project?.name ? `Project: ${row.project.name}` : "New work in your Blocharch Inbox",
    linkPath: `/dashboard/planner?area=team&athlete=me&board=${inboxBoard.id}&task=${task.id}`,
  }).catch(() => {});

  return { taskId: task.id, alreadyDelivered: false };
}

export async function createAndDeliverOutboxTask(input: {
  createdByUserId: string;
  athleteId: string;
  projectId?: string | null;
  title?: string | null;
  description?: string | null;
  dueAt?: Date | null;
  priority?: OpsOutboxPriority;
  labelName?: string | null;
  notes?: string | null;
  attachments?: unknown;
}) {
  const athlete = await prisma.opsAthlete.findUnique({
    where: { id: input.athleteId },
    select: { id: true, status: true },
  });
  if (!athlete || athlete.status !== "active") {
    throw new Error("Athlete not found or inactive");
  }

  if (input.projectId) {
    const project = await prisma.opsProject.findFirst({
      where: { id: input.projectId, assignedAthleteId: input.athleteId },
    });
    if (!project) throw new Error("Project not assigned to this athlete");
  }

  const labelName =
    input.labelName && isApprovedLabelName(input.labelName) ? input.labelName : null;

  const row = await prisma.opsOutboxTask.create({
    data: {
      createdByUserId: input.createdByUserId,
      athleteId: input.athleteId,
      projectId: input.projectId ?? null,
      title: input.title?.trim().slice(0, 200) ?? null,
      description: input.description?.trim() ?? null,
      dueAt: input.dueAt ?? null,
      priority: input.priority ?? "normal",
      labelName,
      notes: input.notes?.trim() ?? null,
      attachments:
        input.attachments === undefined || input.attachments === null
          ? undefined
          : (input.attachments as object),
    },
  });

  await deliverOutboxTaskToInbox(row.id);
  return row.id;
}
