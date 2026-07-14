import { prisma } from "@/lib/prisma";
import { isApprovedLabelName } from "@/lib/planner-approved-labels";

/** Find first column on a board linked to one of the task's label names. */
export async function findLinkedColumnForBoard(
  boardId: string,
  labelNames: string[]
): Promise<string | null> {
  for (const name of labelNames) {
    if (!isApprovedLabelName(name)) continue;
    const col = await prisma.plannerColumn.findFirst({
      where: { boardId, linkedLabelName: name },
      select: { id: true },
    });
    if (col) return col.id;
  }
  return null;
}

export async function relocateTaskToLabelLinkedColumn(taskId: string): Promise<boolean> {
  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: {
      column: { select: { boardId: true } },
      labels: { include: { label: { select: { name: true } } } },
    },
  });
  if (!task) return false;

  const labelNames = task.labels.map((l) => l.label.name);
  const targetColId = await findLinkedColumnForBoard(task.column.boardId, labelNames);
  if (!targetColId || targetColId === task.columnId) return false;

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: targetColId },
    _max: { sortOrder: true },
  });
  await prisma.plannerTask.update({
    where: { id: taskId },
    data: {
      columnId: targetColId,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return true;
}

/** Re-evaluate all tasks on a board after a column label link is added/changed. */
export async function syncBoardLabelLinkedTasks(boardId: string): Promise<void> {
  const tasks = await prisma.plannerTask.findMany({
    where: { column: { boardId } },
    select: { id: true },
  });
  for (const t of tasks) {
    await relocateTaskToLabelLinkedColumn(t.id);
  }
}

export function parseLinkedLabelName(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const name = String(raw).trim();
  if (!name) return null;
  return isApprovedLabelName(name) ? name : null;
}
