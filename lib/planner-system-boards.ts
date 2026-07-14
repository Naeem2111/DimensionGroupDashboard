import type { PlannerBoardKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDefaultColumnsOnBoard } from "@/lib/planner-columns-seed";
import { ensureDefaultLabelsOnBoard } from "@/lib/planner-labels-seed";

export const SYSTEM_BOARD_TITLES = {
  blocharch_outbox: "Blocharch Outbox",
  blocharch_inbox: "Blocharch Inbox",
  my_tasks: "My Tasks",
  completed: "Completed",
} as const satisfies Record<Exclude<PlannerBoardKind, "custom" | "project">, string>;

type Tx = Prisma.TransactionClient;

async function createBoardWithColumns(
  tx: Tx,
  data: {
    title: string;
    scope: "personal" | "team";
    kind: PlannerBoardKind;
    ownerId: string;
    athleteId?: string;
    opsProjectId?: string;
    isSystem: boolean;
    color: string;
  }
) {
  const existing = await tx.plannerBoard.findFirst({
    where: {
      kind: data.kind,
      ownerId: data.ownerId,
      athleteId: data.athleteId ?? null,
      opsProjectId: data.opsProjectId ?? null,
    },
  });
  if (existing) return existing;

  const board = await tx.plannerBoard.create({
    data: {
      title: data.title,
      scope: data.scope,
      kind: data.kind,
      color: data.color,
      ownerId: data.ownerId,
      athleteId: data.athleteId,
      opsProjectId: data.opsProjectId,
      isSystem: data.isSystem,
    },
  });

  await createDefaultColumnsOnBoard(board.id, tx);
  await ensureDefaultLabelsOnBoard(board.id, tx);

  return board;
}

/** One admin Blocharch Outbox board (team scope, system). */
export async function ensureAdminOutboxBoard(adminUserId: string) {
  return createBoardWithColumns(prisma, {
    title: SYSTEM_BOARD_TITLES.blocharch_outbox,
    scope: "team",
    kind: "blocharch_outbox",
    ownerId: adminUserId,
    isSystem: true,
    color: "#f59e0b",
  });
}

/** Fixed athlete workspace boards: Inbox, My Tasks, Completed. */
export async function ensureAthleteSystemBoards(
  athleteId: string,
  athleteUserId: string,
  tx: Tx = prisma
) {
  await createBoardWithColumns(tx, {
    title: SYSTEM_BOARD_TITLES.blocharch_inbox,
    scope: "personal",
    kind: "blocharch_inbox",
    ownerId: athleteUserId,
    athleteId,
    isSystem: true,
    color: "#0ea5e9",
  });
  await createBoardWithColumns(tx, {
    title: SYSTEM_BOARD_TITLES.my_tasks,
    scope: "personal",
    kind: "my_tasks",
    ownerId: athleteUserId,
    athleteId,
    isSystem: true,
    color: "#6366f1",
  });
  await createBoardWithColumns(tx, {
    title: SYSTEM_BOARD_TITLES.completed,
    scope: "personal",
    kind: "completed",
    ownerId: athleteUserId,
    athleteId,
    isSystem: true,
    color: "#22c55e",
  });
}

/** Active project board for an assigned athlete. */
export async function ensureProjectBoard(
  athleteId: string,
  athleteUserId: string,
  projectId: string,
  projectName: string,
  tx: Tx = prisma
) {
  return createBoardWithColumns(tx, {
    title: projectName,
    scope: "personal",
    kind: "project",
    ownerId: athleteUserId,
    athleteId,
    opsProjectId: projectId,
    isSystem: false,
    color: "#a855f7",
  });
}

export function isProtectedSystemBoard(kind: PlannerBoardKind, isSystem: boolean): boolean {
  if (!isSystem) return false;
  return kind !== "custom" && kind !== "project";
}
