export type NudgeDirection = "up" | "down" | "left" | "right";

type NudgeColumn = { id: string; tasks: { id: string }[] };

export type TaskNudgeTarget = {
  destColumnId: string;
  insertBeforeTaskId: string | null;
};

export function findTaskColumnIndex(
  columns: NudgeColumn[],
  taskId: string
): { colIndex: number; taskIndex: number; columnId: string } | null {
  for (let ci = 0; ci < columns.length; ci++) {
    const ti = columns[ci]!.tasks.findIndex((t) => t.id === taskId);
    if (ti >= 0) {
      return { colIndex: ci, taskIndex: ti, columnId: columns[ci]!.id };
    }
  }
  return null;
}

export function computeTaskNudge(
  columns: NudgeColumn[],
  taskId: string,
  direction: NudgeDirection
): TaskNudgeTarget | null {
  const loc = findTaskColumnIndex(columns, taskId);
  if (!loc) return null;

  const { colIndex, taskIndex, columnId } = loc;
  const col = columns[colIndex]!;

  if (direction === "up") {
    if (taskIndex <= 0) return null;
    return { destColumnId: columnId, insertBeforeTaskId: col.tasks[taskIndex - 1]!.id };
  }
  if (direction === "down") {
    if (taskIndex >= col.tasks.length - 1) return null;
    return {
      destColumnId: columnId,
      insertBeforeTaskId: col.tasks[taskIndex + 2]?.id ?? null,
    };
  }
  if (direction === "left") {
    if (colIndex <= 0) return null;
    return { destColumnId: columns[colIndex - 1]!.id, insertBeforeTaskId: null };
  }
  if (direction === "right") {
    if (colIndex >= columns.length - 1) return null;
    return { destColumnId: columns[colIndex + 1]!.id, insertBeforeTaskId: null };
  }
  return null;
}

export function taskNudgeAvailability(
  columns: NudgeColumn[],
  taskId: string
): Record<NudgeDirection, boolean> {
  return {
    up: computeTaskNudge(columns, taskId, "up") !== null,
    down: computeTaskNudge(columns, taskId, "down") !== null,
    left: computeTaskNudge(columns, taskId, "left") !== null,
    right: computeTaskNudge(columns, taskId, "right") !== null,
  };
}
