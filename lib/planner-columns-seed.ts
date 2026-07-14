import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPROVED_PLANNER_LABELS } from "@/lib/planner-approved-labels";
import {
  DEFAULT_PLANNER_COLUMNS,
  isGeneralColumnTitle,
} from "@/lib/planner-default-columns";

type Tx = Prisma.TransactionClient;

type ColumnRow = {
  id: string;
  title: string;
  sortOrder: number;
  linkedLabelName: string | null;
  _count: { tasks: number };
};

function columnMergeKey(col: { title: string; linkedLabelName: string | null }): string {
  if (col.linkedLabelName) return `label:${col.linkedLabelName}`;

  const titleLower = col.title.trim().toLowerCase();
  if (isGeneralColumnTitle(col.title)) return "general";
  if (/^(done|completed)\b/i.test(col.title.trim())) return "done";

  const def = DEFAULT_PLANNER_COLUMNS.find((d) => d.title.toLowerCase() === titleLower);
  if (def?.linkedLabelName) return `label:${def.linkedLabelName}`;
  if (def?.title === "General") return "general";
  if (def?.title === "Done") return "done";

  return `title:${titleLower}`;
}

function pickKeeperColumn(group: ColumnRow[]): ColumnRow {
  return [...group].sort((a, b) => {
    if (a.linkedLabelName && !b.linkedLabelName) return -1;
    if (!a.linkedLabelName && b.linkedLabelName) return 1;
    if (a._count.tasks !== b._count.tasks) return b._count.tasks - a._count.tasks;
    return a.sortOrder - b.sortOrder;
  })[0]!;
}

async function moveTasksToColumn(
  tx: Tx,
  fromColumnId: string,
  toColumnId: string
): Promise<void> {
  const tasks = await tx.plannerTask.findMany({
    where: { columnId: fromColumnId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (tasks.length === 0) return;

  const maxOrder = await tx.plannerTask.aggregate({
    where: { columnId: toColumnId },
    _max: { sortOrder: true },
  });
  let next = (maxOrder._max.sortOrder ?? -1) + 1;
  for (const task of tasks) {
    await tx.plannerTask.update({
      where: { id: task.id },
      data: { columnId: toColumnId, sortOrder: next++ },
    });
  }
}

/** Merge duplicate workflow columns (e.g. two "This Week") and move tasks into the keeper. */
export async function mergeDuplicateColumnsOnBoard(
  boardId: string,
  tx: Tx = prisma
): Promise<number> {
  const columns = await tx.plannerColumn.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { tasks: true } } },
  });

  const groups = new Map<string, ColumnRow[]>();
  for (const col of columns) {
    const key = columnMergeKey(col);
    const list = groups.get(key) ?? [];
    list.push(col);
    groups.set(key, list);
  }

  let merged = 0;
  for (const group of Array.from(groups.values())) {
    if (group.length <= 1) continue;
    const keeper = pickKeeperColumn(group);
    const def = DEFAULT_PLANNER_COLUMNS.find(
      (d) =>
        (d.linkedLabelName && d.linkedLabelName === keeper.linkedLabelName) ||
        (d.title === "General" && columnMergeKey(keeper) === "general") ||
        (d.title === "Done" && columnMergeKey(keeper) === "done")
    );
    if (def && (!keeper.linkedLabelName || keeper.linkedLabelName === def.linkedLabelName)) {
      await tx.plannerColumn.update({
        where: { id: keeper.id },
        data: {
          title: def.title,
          color: def.color,
          linkedLabelName: def.linkedLabelName,
        },
      });
    }

    for (const dup of group) {
      if (dup.id === keeper.id) continue;
      await moveTasksToColumn(tx, dup.id, keeper.id);
      await tx.plannerColumn.delete({ where: { id: dup.id } });
      merged += 1;
    }
  }

  return merged;
}

async function normalizeDefaultColumnSortOrders(boardId: string, tx: Tx = prisma): Promise<void> {
  const columns = await tx.plannerColumn.findMany({
    where: { boardId },
    select: { id: true, title: true, sortOrder: true, linkedLabelName: true },
  });

  for (const def of DEFAULT_PLANNER_COLUMNS) {
    const col = columns.find((c) => {
      if (def.linkedLabelName) return c.linkedLabelName === def.linkedLabelName;
      if (def.title === "General") return isGeneralColumnTitle(c.title);
      if (def.title === "Done") return /^(done|completed)\b/i.test(c.title.trim());
      return false;
    });
    if (col && col.sortOrder !== def.sortOrder) {
      await tx.plannerColumn.update({
        where: { id: col.id },
        data: { sortOrder: def.sortOrder },
      });
    }
  }
}

async function finalizeBoardColumns(boardId: string, tx: Tx = prisma): Promise<void> {
  await mergeDuplicateColumnsOnBoard(boardId, tx);
  await normalizeDefaultColumnSortOrders(boardId, tx);
}

function boardHasLabelLinkedColumns(
  columns: { linkedLabelName: string | null }[]
): boolean {
  return APPROVED_PLANNER_LABELS.some((l) =>
    columns.some((c) => c.linkedLabelName === l.name)
  );
}

/** Create default kanban columns on a new board. */
export async function createDefaultColumnsOnBoard(
  boardId: string,
  tx: Tx = prisma
): Promise<void> {
  await tx.plannerColumn.createMany({
    data: DEFAULT_PLANNER_COLUMNS.map((c) => ({
      boardId,
      title: c.title,
      color: c.color,
      sortOrder: c.sortOrder,
      linkedLabelName: c.linkedLabelName,
    })),
  });
}

/**
 * Backfill label-linked columns on existing boards (idempotent).
 * Renames legacy Backlog → General; adds missing label columns and Done.
 */
export async function ensureDefaultColumnsOnBoard(
  boardId: string,
  tx: Tx = prisma
): Promise<void> {
  await mergeDuplicateColumnsOnBoard(boardId, tx);

  const columns = await tx.plannerColumn.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      linkedLabelName: true,
    },
  });

  if (columns.length === 0) {
    await createDefaultColumnsOnBoard(boardId, tx);
    await finalizeBoardColumns(boardId, tx);
    return;
  }

  if (boardHasLabelLinkedColumns(columns)) {
    const doneExists = columns.some((c) => /^(done|completed)\b/i.test(c.title.trim()));
    if (!doneExists) {
      const maxOrder = Math.max(...columns.map((c) => c.sortOrder), -1);
      await tx.plannerColumn.create({
        data: {
          boardId,
          title: "Done",
          color: "#22c55e",
          sortOrder: maxOrder + 1,
          linkedLabelName: null,
        },
      });
    }
    await finalizeBoardColumns(boardId, tx);
    return;
  }

  const backlog = columns.find((c) => /^backlog\b/i.test(c.title.trim()));
  if (backlog) {
    await tx.plannerColumn.update({
      where: { id: backlog.id },
      data: { title: "General", sortOrder: 0, linkedLabelName: null },
    });
  } else if (!columns.some((c) => isGeneralColumnTitle(c.title))) {
    await tx.plannerColumn.updateMany({
      where: { boardId },
      data: { sortOrder: { increment: 1 } },
    });
    await tx.plannerColumn.create({
      data: {
        boardId,
        title: "General",
        color: "#64748b",
        sortOrder: 0,
        linkedLabelName: null,
      },
    });
  }

  const refreshed = await tx.plannerColumn.findMany({
    where: { boardId },
    select: { id: true, title: true, sortOrder: true, linkedLabelName: true },
  });

  const maxSort = Math.max(...refreshed.map((c) => c.sortOrder), 0);
  let nextSort = maxSort + 1;

  for (const def of DEFAULT_PLANNER_COLUMNS) {
    if (def.title === "General") continue;
    if (def.linkedLabelName) {
      const exists = refreshed.some((c) => c.linkedLabelName === def.linkedLabelName);
      if (exists) continue;
      const titleMatch = refreshed.some(
        (c) => c.title.trim().toLowerCase() === def.title.toLowerCase()
      );
      if (titleMatch) {
        const col = refreshed.find(
          (c) => c.title.trim().toLowerCase() === def.title.toLowerCase()
        );
        if (col) {
          await tx.plannerColumn.update({
            where: { id: col.id },
            data: { linkedLabelName: def.linkedLabelName, color: def.color },
          });
        }
        continue;
      }
    } else if (def.title === "Done") {
      const doneExists = refreshed.some((c) => /^(done|completed)\b/i.test(c.title.trim()));
      if (doneExists) continue;
    } else {
      continue;
    }

    await tx.plannerColumn.create({
      data: {
        boardId,
        title: def.title,
        color: def.color,
        sortOrder: def.linkedLabelName ? def.sortOrder : nextSort++,
        linkedLabelName: def.linkedLabelName,
      },
    });
  }

  await finalizeBoardColumns(boardId, tx);
}
