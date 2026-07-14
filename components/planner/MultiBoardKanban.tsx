"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { KanbanBoardDetail, KanbanTaskRow } from "@/lib/planner-board-mutation";
import { KanbanTaskMovePad } from "@/components/planner/KanbanTaskMovePad";
import { taskNudgeAvailability, type NudgeDirection } from "@/lib/planner-task-nudge";
import { startDragAutoScroll, stopDragAutoScroll, trackDragPointer } from "@/lib/planner-drag-scroll";
import { createDragHighlightScheduler } from "@/lib/planner-drag-ui";

function taskCardDescriptionPreview(description: string | null): string | null {
  const body = (description ?? "").trim();
  if (!body) return null;
  const line = body
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find((x) => x.length > 0);
  return line ?? body.slice(0, 280);
}

function resolveCompletedColumnId(columns: KanbanBoardDetail["columns"]): string | null {
  const named = columns.find((c) => /^(done|completed)\b/i.test(c.title.trim()));
  if (named) return named.id;
  if (columns.length >= 2) return columns[columns.length - 1]!.id;
  return null;
}

function taskCardDropPlacement(e: React.DragEvent, cardEl: HTMLElement): "before" | "after" {
  const r = cardEl.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? "before" : "after";
}

function insertAnchorBeforeId(
  columnTasks: KanbanTaskRow[],
  hoveredTaskId: string,
  placement: "before" | "after",
  draggingId: string | null
): string | null {
  const sans = draggingId ? columnTasks.filter((t) => t.id !== draggingId) : columnTasks;
  if (placement === "before") return hoveredTaskId;
  const ti = sans.findIndex((t) => t.id === hoveredTaskId);
  if (ti === -1) return null;
  const nextRow = sans[ti + 1];
  return nextRow ? nextRow.id : null;
}

type Props = {
  boards: KanbanBoardDetail[];
  hideFixedBadge?: boolean;
  onMoveTask: (
    taskId: string,
    destColumnId: string,
    insertBeforeTaskId: string | null
  ) => void | Promise<void>;
  onOpenTask: (task: KanbanTaskRow, columnId: string, boardId: string) => void;
  onToggleComplete?: (taskId: string, completed: boolean) => void;
  onNudgeTask?: (boardId: string, taskId: string, direction: NudgeDirection) => void;
};

export function MultiBoardKanban({
  boards,
  hideFixedBadge = false,
  onMoveTask,
  onOpenTask,
  onToggleComplete,
  onNudgeTask,
}: Props) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null);
  const [taskDropGuide, setTaskDropGuide] = useState<{
    columnId: string;
    beforeTaskId: string | null;
  } | null>(null);
  const dragTaskIdRef = useRef<string | null>(null);
  const dragHighlightRef = useRef(
    createDragHighlightScheduler((columnId, guide) => {
      setDropTargetColumnId(columnId);
      setTaskDropGuide(guide);
    })
  );

  function clearDragState() {
    stopDragAutoScroll();
    dragHighlightRef.current.cancel();
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
  }

  function scheduleHighlight(
    columnId: string | null,
    guide: { columnId: string; beforeTaskId: string | null } | null
  ) {
    if (!dragTaskIdRef.current) return;
    dragHighlightRef.current.schedule(columnId, guide);
  }

  useEffect(() => {
    const onEnd = () => {
      requestAnimationFrame(() => {
        if (dragTaskIdRef.current) clearDragState();
      });
    };
    window.addEventListener("dragend", onEnd);
    return () => window.removeEventListener("dragend", onEnd);
  }, []);

  function resolveDraggedId(dt?: DataTransfer | null) {
    return dragTaskIdRef.current || dragTaskId || dt?.getData("text/plain")?.trim() || null;
  }

  function handleDropColumn(columnId: string, dt?: DataTransfer | null) {
    const taskId = resolveDraggedId(dt);
    dragHighlightRef.current.cancel();
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
    if (!taskId) return;
    void onMoveTask(taskId, columnId, null);
  }

  function handleDropCard(columnId: string, anchorTaskId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const taskId = resolveDraggedId(e.dataTransfer);
    dragHighlightRef.current.cancel();
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
    if (!taskId || taskId === anchorTaskId) return;
    const board = boards.find((b) => b.columns.some((c) => c.id === columnId));
    const col = board?.columns.find((c) => c.id === columnId);
    if (!col) return;
    const placement = taskCardDropPlacement(e, e.currentTarget as HTMLElement);
    const beforeId = insertAnchorBeforeId(col.tasks, anchorTaskId, placement, taskId);
    void onMoveTask(taskId, columnId, beforeId);
  }

  function handleDropRail(columnId: string, beforeTaskId: string | null, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const taskId = resolveDraggedId(e.dataTransfer);
    dragHighlightRef.current.cancel();
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
    if (!taskId) return;
    void onMoveTask(taskId, columnId, beforeTaskId);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {boards.map((board) => {
        const completedColumnId = resolveCompletedColumnId(board.columns);

        return (
          <section
            key={board.id}
            id={`planner-board-${board.id}`}
            className="planner-kanban-column flex w-[min(100%,920px)] shrink-0 flex-col rounded-xl border border-white/[0.08] bg-white/[0.02]"
          >
            <header
              className="sticky left-0 border-b border-white/[0.06] px-3 py-2"
              style={{ borderLeftWidth: 4, borderLeftColor: board.color }}
            >
              <h3 className="text-sm font-semibold text-white">{board.title}</h3>
              {board.isSystem && !hideFixedBadge ? (
                <span className="text-[10px] uppercase text-amber-500/80">fixed board</span>
              ) : null}
            </header>
            <div className="flex gap-3 overflow-x-auto p-3" data-planner-scroll-x>
              {board.columns.map((col) => (
                <div
                  key={col.id}
                  className={`flex w-[min(72vw,260px)] shrink-0 flex-col rounded-lg border border-white/[0.08] bg-black/20 sm:w-[260px] ${
                    dragTaskId && dropTargetColumnId === col.id ? "ring-2 ring-brand-500/30" : ""
                  }`}
                  onDragOver={(e) => {
                    if (!board.editable || !dragTaskIdRef.current) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    trackDragPointer(e.clientX, e.clientY);
                    startDragAutoScroll();
                    scheduleHighlight(col.id, null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropColumn(col.id, e.dataTransfer);
                  }}
                >
                  <div
                    className="border-b border-white/[0.06] px-2 py-2 text-xs font-medium text-slate-300"
                    style={{ borderTop: `3px solid ${col.color}` }}
                  >
                    {col.title}
                  </div>
                  <div
                    data-planner-scroll-y
                    className="flex min-h-[120px] max-h-[min(65vh,640px)] flex-col gap-2 overflow-y-auto overscroll-y-contain p-2"
                    onDragOver={(e) => {
                      if (!board.editable || !dragTaskIdRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      trackDragPointer(e.clientX, e.clientY);
                    startDragAutoScroll();
                      scheduleHighlight(col.id, { columnId: col.id, beforeTaskId: null });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropColumn(col.id, e.dataTransfer);
                    }}
                  >
                    {col.tasks.map((t) => {
                      const showInsertLine =
                        dragTaskId &&
                        dragTaskId !== t.id &&
                        taskDropGuide?.columnId === col.id &&
                        taskDropGuide.beforeTaskId === t.id;
                      const showDoneTick =
                        board.editable &&
                        completedColumnId !== null &&
                        board.columns.length >= 2;
                      const isInDoneColumn = col.id === completedColumnId;
                      const nudge =
                        board.editable && onNudgeTask
                          ? taskNudgeAvailability(board.columns, t.id)
                          : null;

                      const isSelected = selectedTaskId === t.id;

                      return (
                        <Fragment key={t.id}>
                          {showInsertLine ? (
                            <div className="h-0.5 shrink-0 rounded-full bg-brand-400/85" />
                          ) : null}
                          {board.editable && dragTaskId && dragTaskId !== t.id ? (
                            <div
                              className="h-3 shrink-0 rounded hover:bg-brand-500/10"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                scheduleHighlight(col.id, { columnId: col.id, beforeTaskId: t.id });
                              }}
                              onDrop={(e) => handleDropRail(col.id, t.id, e)}
                            />
                          ) : null}
                          <div
                            draggable={board.editable}
                            role="button"
                            tabIndex={0}
                            onDragStart={(e) => {
                              if (!board.editable) return;
                              dragTaskIdRef.current = t.id;
                              setDragTaskId(t.id);
                              startDragAutoScroll();
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", t.id);
                            }}
                            onDragOver={(e) => {
                              if (!board.editable || !dragTaskIdRef.current || dragTaskIdRef.current === t.id)
                                return;
                              e.preventDefault();
                              e.stopPropagation();
                              const placement = taskCardDropPlacement(e, e.currentTarget as HTMLElement);
                              const guideBeforeId = insertAnchorBeforeId(
                                col.tasks,
                                t.id,
                                placement,
                                dragTaskIdRef.current
                              );
                              scheduleHighlight(col.id, {
                                columnId: col.id,
                                beforeTaskId: guideBeforeId,
                              });
                            }}
                            onDrop={(e) => handleDropCard(col.id, t.id, e)}
                            onClick={() => setSelectedTaskId(t.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                              onOpenTask(t, col.id, board.id);
                            }}
                            onKeyDown={(e) => {
                              if (board.editable && onNudgeTask) {
                                const keyMap: Record<string, NudgeDirection> = {
                                  ArrowUp: "up",
                                  ArrowDown: "down",
                                  ArrowLeft: "left",
                                  ArrowRight: "right",
                                };
                                const dir = keyMap[e.key];
                                if (dir) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onNudgeTask(board.id, t.id, dir);
                                  return;
                                }
                              }
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (isSelected) {
                                  onOpenTask(t, col.id, board.id);
                                } else {
                                  setSelectedTaskId(t.id);
                                }
                              }
                            }}
                            className={`planner-task-card cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.04] p-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
                              isSelected ? "ring-2 ring-brand-500/45 bg-brand-500/[0.08]" : ""
                            } ${dragTaskId === t.id ? "opacity-40" : "hover:bg-white/[0.07]"}`}
                          >
                            <div className="flex gap-2">
                              {showDoneTick && onToggleComplete ? (
                                <input
                                  type="checkbox"
                                  checked={isInDoneColumn}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleComplete(t.id, e.target.checked);
                                  }}
                                  className="mt-0.5"
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-slate-100">{t.title}</p>
                                {taskCardDescriptionPreview(t.description) ? (
                                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                                    {taskCardDescriptionPreview(t.description)}
                                  </p>
                                ) : null}
                              </div>
                              {nudge ? (
                                <KanbanTaskMovePad
                                  onNudge={(dir) => onNudgeTask!(board.id, t.id, dir)}
                                  canUp={nudge.up}
                                  canDown={nudge.down}
                                  canLeft={nudge.left}
                                  canRight={nudge.right}
                                />
                              ) : null}
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                    {board.editable && dragTaskId ? (
                      <div
                        className="h-4 shrink-0"
                        onDragOver={(e) => {
                          e.preventDefault();
                          scheduleHighlight(col.id, { columnId: col.id, beforeTaskId: null });
                        }}
                        onDrop={(e) => handleDropRail(col.id, null, e)}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
