/** Client-side optimistic Kanban layout helpers (mirrors server move semantics). */

export type KanbanTaskRow = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  sortOrder: number;
  assigneeId: string | null;
  dueAt: string | null;
  architectUrl: string | null;
  customFields: Record<string, unknown> | null;
  linkedFromTaskId?: string | null;
  assignee: { id: string; username: string } | null;
  labels: Array<{ label: { id: string; name: string; color: string } }>;
  leadStage?: string | null;
};

export type KanbanColumnRow = {
  id: string;
  title: string;
  color: string;
  sortOrder: number;
  linkedLabelName?: string | null;
  tasks: KanbanTaskRow[];
};

export type KanbanBoardDetail = {
  id: string;
  title: string;
  scope: "personal" | "team";
  kind?: string;
  athleteId?: string | null;
  isSystem?: boolean;
  color: string;
  editable: boolean;
  columns: KanbanColumnRow[];
};

function normalizeColumnTaskOrder(col: KanbanColumnRow): KanbanColumnRow {
  return {
    ...col,
    tasks: col.tasks.map((t, i) => ({ ...t, sortOrder: i })),
  };
}

export function boardDetailAfterMovingTask(
  detail: KanbanBoardDetail,
  taskId: string,
  destColumnId: string,
  insertBeforeTaskId: string | null
): KanbanBoardDetail {
  let mover: KanbanTaskRow | null = null;

  const stripped = detail.columns.map((col) => {
    const found = col.tasks.find((t) => t.id === taskId);
    if (!found) return col;
    mover = found;
    return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
  });

  if (!mover) return detail;

  const merged = stripped.map((col) => {
    if (col.id !== destColumnId) return col;
    const ts = [...col.tasks];
    let insertAt = ts.length;
    if (insertBeforeTaskId !== null) {
      const bi = ts.findIndex((t) => t.id === insertBeforeTaskId);
      insertAt = bi === -1 ? ts.length : bi;
    }
    const mergedTasks = [...ts.slice(0, insertAt), mover!, ...ts.slice(insertAt)].map((t, i) => ({
      ...t,
      sortOrder: i,
    }));
    return { ...col, tasks: mergedTasks };
  });

  return {
    ...detail,
    columns: merged.map(normalizeColumnTaskOrder),
  };
}

export function boardDetailAfterCrossBoardMove(
  source: KanbanBoardDetail,
  dest: KanbanBoardDetail,
  taskId: string,
  destColumnId: string,
  insertBeforeTaskId: string | null
): { source: KanbanBoardDetail; dest: KanbanBoardDetail } {
  let mover: KanbanTaskRow | null = null;
  const sourceStripped = source.columns.map((col) => {
    const found = col.tasks.find((t) => t.id === taskId);
    if (found) mover = found;
    return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
  });
  if (!mover) return { source, dest };

  const destMerged = dest.columns.map((col) => {
    if (col.id !== destColumnId) return col;
    const ts = [...col.tasks];
    let insertAt = ts.length;
    if (insertBeforeTaskId !== null) {
      const bi = ts.findIndex((t) => t.id === insertBeforeTaskId);
      insertAt = bi === -1 ? ts.length : bi;
    }
    const mergedTasks = [...ts.slice(0, insertAt), mover!, ...ts.slice(insertAt)].map((t, i) => ({
      ...t,
      sortOrder: i,
    }));
    return { ...col, tasks: mergedTasks };
  });

  return {
    source: { ...source, columns: sourceStripped.map(normalizeColumnTaskOrder) },
    dest: { ...dest, columns: destMerged.map(normalizeColumnTaskOrder) },
  };
}

export function findBoardIdForColumn(
  boards: Record<string, KanbanBoardDetail>,
  columnId: string
): string | null {
  for (const b of Object.values(boards)) {
    if (b.columns.some((c) => c.id === columnId)) return b.id;
  }
  return null;
}
