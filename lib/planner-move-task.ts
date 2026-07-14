import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditBoard } from "@/lib/planner-access";

export async function movePlannerTaskToColumn(
  user: SessionUser,
  taskId: string,
  destColumnId: string,
  insertBeforeTaskId: string | null
): Promise<{ sourceBoardId: string; destBoardId: string }> {
  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: { column: { select: { id: true, boardId: true } } },
  });
  if (!task) throw new Error("Task not found");

  const sourceBoardId = task.column.boardId;
  const sourceColumnId = task.column.id;

  const destCol = await prisma.plannerColumn.findUnique({
    where: { id: destColumnId },
    select: { id: true, boardId: true },
  });
  if (!destCol) throw new Error("Invalid column");

  if (!(await canEditBoard(user, sourceBoardId))) throw new Error("Forbidden");
  if (!(await canEditBoard(user, destCol.boardId))) throw new Error("Forbidden on target board");

  await prisma.$transaction(async (tx) => {
    if (sourceColumnId !== destColumnId) {
      const sourceTasks = await tx.plannerTask.findMany({
        where: { columnId: sourceColumnId },
        orderBy: { sortOrder: "asc" },
      });
      const sourceRemaining = sourceTasks.filter((t) => t.id !== taskId);
      for (let i = 0; i < sourceRemaining.length; i++) {
        await tx.plannerTask.update({
          where: { id: sourceRemaining[i].id },
          data: { sortOrder: i },
        });
      }
    }

    const destTasks = await tx.plannerTask.findMany({
      where: { columnId: destColumnId },
      orderBy: { sortOrder: "asc" },
    });
    const destSans = destTasks.filter((t) => t.id !== taskId);
    let insertAt = destSans.length;
    if (insertBeforeTaskId) {
      const idx = destSans.findIndex((t) => t.id === insertBeforeTaskId);
      insertAt = idx === -1 ? destSans.length : idx;
    }
    const merged = [...destSans.slice(0, insertAt), task, ...destSans.slice(insertAt)];
    for (let i = 0; i < merged.length; i++) {
      await tx.plannerTask.update({
        where: { id: merged[i].id },
        data: { columnId: destColumnId, sortOrder: i },
      });
    }
  });

  return { sourceBoardId, destBoardId: destCol.boardId };
}
