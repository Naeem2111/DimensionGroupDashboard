import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RestoreMeta = {
  columnId: string;
  boardId: string;
  sortOrder: number;
};

function readRestoreMeta(customFields: unknown): RestoreMeta | null {
  if (!customFields || typeof customFields !== "object") return null;
  const r = (customFields as Record<string, unknown>).completedRestore;
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.columnId !== "string" || typeof o.boardId !== "string") return null;
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : 0;
  return { columnId: o.columnId, boardId: o.boardId, sortOrder };
}

function mergeCustomFields(
  existing: unknown,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

function resolveDoneColumn(columns: { id: string; title: string }[]) {
  const doneCol =
    columns.find((c) => /^(done|completed)\b/i.test(c.title.trim())) ??
    columns[columns.length - 1];
  const firstCol = columns[0];
  return { doneCol, firstCol };
}

/** Done / Completed column id for a board, if any. */
export function findDoneColumnId(columns: { id: string; title: string }[]): string | null {
  const { doneCol } = resolveDoneColumn(columns);
  return doneCol?.id ?? null;
}

/** Move task to this board's Done column (or restore to prior column). */
export async function setPlannerTaskCompleted(taskId: string, completed: boolean) {
  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: {
      column: {
        include: {
          board: {
            select: {
              id: true,
              kind: true,
              columns: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!task) throw new Error("Task not found");

  const board = task.column.board;
  const { doneCol, firstCol } = resolveDoneColumn(board.columns);
  if (!doneCol || !firstCol) throw new Error("Board has no columns");

  if (completed) {
    if (task.columnId === doneCol.id) return { taskId, noop: true };

    const restore: RestoreMeta = {
      columnId: task.columnId,
      boardId: board.id,
      sortOrder: task.sortOrder,
    };

    const maxOrder = await prisma.plannerTask.aggregate({
      where: { columnId: doneCol.id },
      _max: { sortOrder: true },
    });

    await prisma.plannerTask.update({
      where: { id: taskId },
      data: {
        columnId: doneCol.id,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        customFields: mergeCustomFields(task.customFields, { completedRestore: restore }),
      },
    });
    return { taskId, completed: true };
  }

  const restore = readRestoreMeta(task.customFields);
  if (task.columnId !== doneCol.id) return { taskId, noop: true };

  let destColumnId = restore?.columnId ?? firstCol.id;
  if (restore) {
    const colStill = await prisma.plannerColumn.findFirst({
      where: { id: restore.columnId, boardId: restore.boardId },
    });
    if (!colStill) {
      const fallback = await prisma.plannerColumn.findFirst({
        where: { boardId: restore.boardId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      destColumnId = fallback?.id ?? firstCol.id;
    }
  }

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: destColumnId },
    _max: { sortOrder: true },
  });

  await prisma.plannerTask.update({
    where: { id: taskId },
    data: {
      columnId: destColumnId,
      sortOrder: restore
        ? Math.min(restore.sortOrder, (maxOrder._max.sortOrder ?? -1) + 1)
        : (maxOrder._max.sortOrder ?? -1) + 1,
      customFields: mergeCustomFields(task.customFields, { completedRestore: null }),
    },
  });
  return { taskId, completed: false };
}

/** Card shows checked when sitting in the board's Done column. */
export function taskShowsAsCompleted(
  columnId: string,
  columns: { id: string; title: string }[]
): boolean {
  const { doneCol } = resolveDoneColumn(columns);
  return !!doneCol && columnId === doneCol.id;
}

/** @deprecated Completed board removed — always use per-board Done column. */
export function usesAthleteCompletedFlow(_boardKind: string, _athleteId: string | null): boolean {
  return false;
}
