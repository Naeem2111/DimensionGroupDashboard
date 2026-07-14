"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { composeDueAtIso, splitDueAtIso } from "@/lib/planner-due-datetime";
import { KanbanTaskMovePad } from "@/components/planner/KanbanTaskMovePad";
import { BlocharchOutboxPanel } from "@/components/planner/BlocharchOutboxPanel";
import { MultiBoardKanban } from "@/components/planner/MultiBoardKanban";
import { PlannerLabelChip, plannerLabelChipStyle } from "@/components/planner/PlannerLabelChip";
import {
  boardDetailAfterCrossBoardMove,
  boardDetailAfterMovingTask,
  findBoardIdForColumn,
  type KanbanBoardDetail,
} from "@/lib/planner-board-mutation";
import { startDragAutoScroll, stopDragAutoScroll, trackDragPointer } from "@/lib/planner-drag-scroll";
import { createDragHighlightScheduler } from "@/lib/planner-drag-ui";
import { APPROVED_PLANNER_LABELS } from "@/lib/planner-approved-labels";
import { resolveGeneralColumnId } from "@/lib/planner-default-columns";
import {
  computeTaskNudge,
  taskNudgeAvailability,
  type NudgeDirection,
} from "@/lib/planner-task-nudge";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

const FIXED_BOARD_KINDS = new Set([
  "blocharch_outbox",
  "blocharch_inbox",
  "my_tasks",
  "completed",
]);

type BoardSummary = {
  id: string;
  title: string;
  scope: "personal" | "team";
  kind?: string;
  isSystem?: boolean;
  color: string;
  sortOrder: number;
  ownerId: string;
  updatedAt: string;
  owner: { username: string };
  _count: { columns: number };
};

type TeamAthleteRow = {
  id: string;
  userId: string;
  fullName: string;
  athleteCode: string;
  username: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor?: string | null;
  profilePhotoTextTone?: string | null;
  activeProjects: number;
};

type Label = { id: string; name: string; color: string };
type Assignee = { id: string; username: string };
type TaskLbl = { label: Label };

type TaskRow = {
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
  assignee: Assignee | null;
  labels: TaskLbl[];
  leadStage?: string | null;
};

type ColumnRow = {
  id: string;
  title: string;
  color: string;
  sortOrder: number;
  linkedLabelName?: string | null;
  tasks: TaskRow[];
};

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; username: string; role: string };
};

type BoardDetail = {
  id: string;
  title: string;
  scope: "personal" | "team";
  kind?: string;
  athleteId?: string | null;
  isSystem?: boolean;
  color: string;
  ownerId: string;
  owner: Assignee;
  columns: ColumnRow[];
  labels: Label[];
  members: MemberRow[];
  editable: boolean;
  canManageMembers: boolean;
};

type AssigneeOption = { id: string; username: string; role: string };

function resolveBacklogColumnId(columns: ColumnRow[]): string | null {
  return resolveGeneralColumnId(columns);
}

function googleEventUrl(title: string, due: Date) {
  const start = due;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Snippet from task description for board cards */
function taskCardDescriptionPreview(description: string | null): string | null {
  const body = (description ?? "").trim();
  if (!body) return null;
  const line = body
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find((x) => x.length > 0);
  return line ?? body.slice(0, 280);
}

/** Column used for “mark done” — explicit Done/Completed title, else last column if there are at least two */
function resolveCompletedColumnId(columns: ColumnRow[]): string | null {
  const named = columns.find((c) => /^(done|completed)\b/i.test(c.title.trim()));
  if (named) return named.id;
  if (columns.length >= 2) return columns[columns.length - 1]!.id;
  return null;
}

function optimisticCompleteTaskBoard(
  board: BoardDetail,
  taskId: string,
  completed: boolean,
  doneColumnId: string
): BoardDetail {
  let task: TaskRow | undefined;
  const stripped = board.columns.map((col) => {
    const idx = col.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return col;
    task = col.tasks[idx];
    return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
  });
  if (!task) return board;
  const destId = completed
    ? doneColumnId
    : board.columns.find((c) => c.id !== doneColumnId)?.id ?? board.columns[0]!.id;
  return {
    ...board,
    columns: stripped.map((col) =>
      col.id === destId ? { ...col, tasks: [...col.tasks, task!] } : col
    ),
  };
}

function PlannerDoneToggle({
  checked,
  disabled,
  onToggle,
  title,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!checked);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`planner-done-toggle mt-0.5 shrink-0 ${checked ? "planner-done-toggle-checked" : ""}`}
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
          <path
            d="M2 6l3 3 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
}

const PLANNER_SHORT_DESC_HINT =
  "Brief preview on the board. Paragraphs or lists work (– or • for bullets; line breaks stay).";

const PLANNER_LONG_DESC_HINT =
  "Detailed notes: paragraphs, bullets (– •), or numbered lines (1. 2.). Plain text — line breaks are kept.";

function removePlannerDragGhosts() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-planner-drag-ghost]").forEach((el) => el.remove());
}

function normalizeColumnTaskOrder(col: ColumnRow): ColumnRow {
  return {
    ...col,
    tasks: col.tasks.map((t, i) => ({ ...t, sortOrder: i })),
  };
}

function findBoardContainingTask(
  boards: Record<string, BoardDetail>,
  single: BoardDetail | null,
  taskId: string
): BoardDetail | null {
  for (const b of Object.values(boards)) {
    for (const col of b.columns) {
      if (col.tasks.some((t) => t.id === taskId)) return b;
    }
  }
  if (single) {
    for (const col of single.columns) {
      if (col.tasks.some((t) => t.id === taskId)) return single;
    }
  }
  return null;
}

/** Where to slice a card vertically for “drop before vs after”. */
function taskCardDropPlacement(e: React.DragEvent, cardEl: HTMLElement): "before" | "after" {
  const r = cardEl.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? "before" : "after";
}

function insertAnchorBeforeId(
  columnTasks: TaskRow[],
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

export function PlannerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const area = searchParams.get("area");
  const athleteParam = searchParams.get("athlete");
  const focusBoardId = searchParams.get("board");
  const focusTaskId = searchParams.get("task");

  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BoardDetail | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScope, setNewScope] = useState<"personal" | "team">("personal");
  const [newBoardColor, setNewBoardColor] = useState("#6366f1");
  const [taskOpen, setTaskOpen] = useState<{ columnId: string } | null>(null);
  const [editTask, setEditTask] = useState<TaskRow & { columnId: string } | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null);
  /** Drop stripe: insert before row id (null = end of column). */
  const [taskDropGuide, setTaskDropGuide] = useState<{
    columnId: string;
    beforeTaskId: string | null;
  } | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState("#64748b");
  const [newColLinkedLabel, setNewColLinkedLabel] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<"admin" | "manager" | "user" | null>(null);
  /** Resolves athlete portal sidebar link `athlete=me` to the signed-in user id. */
  const athleteUserId = athleteParam === "me" ? currentUserId : athleteParam;
  const [teamAthletes, setTeamAthletes] = useState<TeamAthleteRow[]>([]);
  const [teamAthletesLoading, setTeamAthletesLoading] = useState(false);
  const [selectedAthleteName, setSelectedAthleteName] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ taskId: string; title: string } | null>(null);
  const [moveBoardId, setMoveBoardId] = useState<string | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [allBoardsView, setAllBoardsView] = useState(false);
  const [boardDetailsById, setBoardDetailsById] = useState<Record<string, BoardDetail>>({});
  const [dropTargetBoardId, setDropTargetBoardId] = useState<string | null>(null);
  const [boardsLoading, setBoardsLoading] = useState(false);

  const suppressNextCardClickRef = useRef(false);
  /** Mirrors dragTaskId for drop handlers (state can lag in edge timings). */
  const dragTaskIdRef = useRef<string | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const moveInFlightRef = useRef(false);
  const detailRef = useRef(detail);
  const boardsDetailRef = useRef<Record<string, BoardDetail>>({});
  const dragHighlightRef = useRef(
    createDragHighlightScheduler((columnId, guide) => {
      setDropTargetColumnId(columnId);
      setTaskDropGuide(guide);
    })
  );

  useEffect(() => {
    removePlannerDragGhosts();
    return () => removePlannerDragGhosts();
  }, []);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    boardsDetailRef.current = boardDetailsById;
  }, [boardDetailsById]);

  useEffect(() => {
    dragTaskIdRef.current = dragTaskId;
  }, [dragTaskId]);

  function clearDragState() {
    stopDragAutoScroll();
    dragHighlightRef.current.cancel();
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    setDropTargetColumnId(null);
    setDropTargetBoardId(null);
    setTaskDropGuide(null);
    removePlannerDragGhosts();
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }

  function scheduleDragHighlight(
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

  const completedColumnId = useMemo(
    () => (detail ? resolveCompletedColumnId(detail.columns) : null),
    [detail]
  );

  async function toggleTaskCompleted(taskId: string, completed: boolean) {
    const snapshot = detail;
    if (snapshot && completedColumnId) {
      const optimistic = optimisticCompleteTaskBoard(snapshot, taskId, completed, completedColumnId);
      setDetail(optimistic);
      setBoardDetailsById((prev) => ({ ...prev, [snapshot.id]: optimistic }));
    }

    const r = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (snapshot) {
        setDetail(snapshot);
        setBoardDetailsById((prev) => ({ ...prev, [snapshot.id]: snapshot }));
      }
      window.alert((j as { error?: string }).error || "Could not update task");
      return;
    }
    void (async () => {
      if (allBoardsView) await loadAllBoardDetails();
      else if (boardId) await loadDetail(boardId);
      await refreshBoards();
    })();
  }

  const canUseTeamRoster = currentRole === "admin" || currentRole === "manager";
  const isAthleteSelfView = currentRole === "user";
  const showHub = !area;
  const showTeamRoster =
    area === "team" && !athleteUserId && athleteParam !== "me" && canUseTeamRoster;
  const showBoardPicker = area === "personal" || (area === "team" && !!athleteUserId);

  const refreshBoards = useCallback(async () => {
    const qs = athleteUserId ? `?ownerUserId=${encodeURIComponent(athleteUserId)}` : "";
    const r = await fetch(`/api/planner/boards${qs}`);
    const j = await r.json();
    if (r.ok) setBoards(j.boards || []);
  }, [athleteUserId]);

  const loadDetail = useCallback(async (id: string): Promise<BoardDetail | null> => {
    const r = await fetch(`/api/planner/boards/${encodeURIComponent(id)}`);
    const j = await r.json();
    if (!r.ok) return null;
    const typed = j as BoardDetail;
    setDetail(typed);
    setBoardDetailsById((prev) => ({ ...prev, [id]: typed }));
    return typed;
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && typeof j?.user?.id === "string") {
          setCurrentUserId(j.user.id);
          const role = j?.user?.role;
          if (role === "admin" || role === "manager" || role === "user") {
            setCurrentRole(role);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (athleteParam !== "me" && area !== "team") return;
    let cancelled = false;
    const loadInboxBadges = () => {
      fetch("/api/athlete/sidebar-badges")
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!cancelled && r.ok) setInboxUnreadCount(Number(j.inbox) || 0);
        })
        .catch(() => {});
    };
    loadInboxBadges();
    const t = window.setInterval(loadInboxBadges, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [athleteParam, area]);

  useEffect(() => {
    if (!showTeamRoster) return;
    setTeamAthletesLoading(true);
    fetch("/api/planner/athletes")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) setTeamAthletes(j.athletes || []);
      })
      .finally(() => setTeamAthletesLoading(false));
  }, [showTeamRoster]);

  useEffect(() => {
    if (!athleteUserId) {
      setSelectedAthleteName(null);
      return;
    }
    const row = teamAthletes.find((a) => a.userId === athleteUserId);
    if (row) setSelectedAthleteName(row.fullName);
    else {
      fetch("/api/planner/athletes")
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return;
          const list = (j.athletes || []) as TeamAthleteRow[];
          setTeamAthletes(list);
          const hit = list.find((a) => a.userId === athleteUserId);
          if (hit) setSelectedAthleteName(hit.fullName);
        })
        .catch(() => {});
    }
  }, [athleteUserId, teamAthletes]);

  useEffect(() => {
    if (currentRole === "user" && !area) {
      router.replace("/dashboard/planner?area=team&athlete=me");
    }
  }, [currentRole, area, router]);

  const filteredBoards = useMemo(() => {
    const hideCompleted = (b: BoardSummary) => b.kind !== "completed";
    if (area === "personal" && currentUserId) {
      return boards.filter(
        (b) =>
          hideCompleted(b) &&
          b.ownerId === currentUserId &&
          (b.scope === "personal" || b.kind === "blocharch_outbox")
      );
    }
    if (area === "team" && athleteUserId) {
      return boards.filter((b) => hideCompleted(b) && b.ownerId === athleteUserId);
    }
    return [];
  }, [boards, area, currentUserId, athleteUserId]);

  const inboxMoveTargets = useMemo(() => {
    return filteredBoards.filter(
      (b) => b.kind !== "blocharch_inbox" && b.kind !== "blocharch_outbox"
    );
  }, [filteredBoards]);

  const loadAllBoardDetails = useCallback(async () => {
    const ids = filteredBoards
      .filter((b) => b.kind !== "blocharch_outbox")
      .map((b) => b.id);
    if (ids.length === 0) return;
    setBoardsLoading(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const r = await fetch(`/api/planner/boards/${encodeURIComponent(id)}`);
          const j = await r.json();
          return r.ok ? (j as BoardDetail) : null;
        })
      );
      const map: Record<string, BoardDetail> = {};
      for (const bd of results) {
        if (bd?.id) map[bd.id] = bd;
      }
      setBoardDetailsById(map);
      if (boardId && map[boardId]) setDetail(map[boardId]);
    } finally {
      setBoardsLoading(false);
    }
  }, [filteredBoards, boardId]);

  useEffect(() => {
    if (allBoardsView && showBoardPicker && filteredBoards.length > 0) {
      void loadAllBoardDetails();
    }
  }, [allBoardsView, showBoardPicker, filteredBoards, loadAllBoardDetails]);

  const multiBoardList = useMemo(
    () =>
      Object.values(boardDetailsById)
        .filter((b) => b.kind !== "blocharch_outbox")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [boardDetailsById]
  );

  function goPlanner(params: { area?: string; athlete?: string }) {
    const p = new URLSearchParams();
    if (params.area) p.set("area", params.area);
    if (params.athlete) p.set("athlete", params.athlete);
    const q = p.toString();
    router.push(q ? `/dashboard/planner?${q}` : "/dashboard/planner");
    setBoardId(null);
    setDetail(null);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      refreshBoards(),
      fetch("/api/planner/assignees")
        .then((r) => r.json())
        .then((j) => setAssignees(j.users || [])),
    ]).finally(() => setLoading(false));
  }, [refreshBoards]);

  useEffect(() => {
    if (!focusTaskId || !focusBoardId || boards.length === 0) return;
    void navigateBoardAndFocusTask(focusBoardId, focusTaskId);
  }, [focusBoardId, focusTaskId, boards.length]);

  useEffect(() => {
    if (!showBoardPicker) {
      setBoardId(null);
      setDetail(null);
      return;
    }
    if (!boardId && filteredBoards.length > 0) {
      setBoardId(filteredBoards[0]!.id);
    }
  }, [boards, boardId, showBoardPicker, filteredBoards]);

  useEffect(() => {
    if (boardId && showBoardPicker) loadDetail(boardId);
    else if (!showBoardPicker) setDetail(null);
  }, [boardId, loadDetail, showBoardPicker]);

  async function navigateBoardAndFocusTask(targetBoardId: string, taskId: string) {
    setBoardId(targetBoardId);
    const bd = await loadDetail(targetBoardId);
    if (!bd) return;
    for (const col of bd.columns) {
      const row = col.tasks.find((x) => x.id === taskId);
      if (row) {
        setEditTask({ ...row, columnId: col.id });
        break;
      }
    }
    if (athleteParam === "me" && bd.kind === "blocharch_inbox") {
      await fetch("/api/athlete/notifications/mark-task-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      }).catch(() => {});
      setInboxUnreadCount(0);
    }
  }

  function openInboxMoveModal(taskId: string, taskTitle: string) {
    const firstBoard = inboxMoveTargets[0]?.id ?? null;
    setMoveModal({ taskId, title: taskTitle });
    setMoveBoardId(firstBoard);
  }

  async function confirmMoveToBoard() {
    if (!moveModal?.taskId || !moveBoardId) return;
    setMoveSaving(true);
    try {
      const r = await fetch("/api/planner/tasks/move-to-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTaskId: moveModal.taskId,
          targetBoardId: moveBoardId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        window.alert((j as { error?: string }).error || "Could not move to board");
        return;
      }
      const targetBid = typeof j.targetBoardId === "string" ? j.targetBoardId : moveBoardId;
      setMoveModal(null);
      setBoardId(targetBid);
      await refreshBoards();
      await loadDetail(targetBid);
    } finally {
      setMoveSaving(false);
    }
  }

  function applyTaskNudge(board: BoardDetail, taskId: string, direction: NudgeDirection) {
    if (!board.editable) return;
    const target = computeTaskNudge(board.columns, taskId, direction);
    if (!target) return;
    reorderTasksAndPersist(board, taskId, target.destColumnId, target.insertBeforeTaskId);
  }

  function nudgeTask(taskId: string, direction: NudgeDirection) {
    const snap = detailRef.current;
    if (!snap) return;
    applyTaskNudge(snap, taskId, direction);
  }

  function nudgeTaskOnBoard(boardId: string, taskId: string, direction: NudgeDirection) {
    const board =
      boardsDetailRef.current[boardId] ??
      (detailRef.current?.id === boardId ? detailRef.current : null);
    if (!board) return;
    applyTaskNudge(board, taskId, direction);
  }

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/planner/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, scope: newScope, color: newBoardColor }),
    });
    if (!r.ok) return;
    setNewTitle("");
    setNewBoardOpen(false);
    await refreshBoards();
    const j = await r.json();
    if (j.board?.id) setBoardId(j.board.id);
  }

  async function renameBoard(id: string, currentTitle: string) {
    const t = window.prompt("Board name", currentTitle)?.trim();
    if (!t) return;
    await fetch(`/api/planner/boards/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    await refreshBoards();
    await loadDetail(id);
  }

  async function deleteBoard(boardId: string, title: string) {
    if (!window.confirm(`Delete board "${title}"? Tasks on this board will be removed.`)) return;
    const r = await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}`, { method: "DELETE" });
    if (!r.ok) return;
    setBoardId(null);
    setDetail(null);
    await refreshBoards();
  }

  async function addTask(
    columnId: string,
    data: {
      title: string;
      summary?: string | null;
      description?: string | null;
      assigneeId?: string | null;
      dueAt?: string | null;
      architectUrl?: string | null;
      labelIds?: string[];
    }
  ) {
    const r = await fetch("/api/planner/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, ...data }),
    });
    if (r.ok && boardId) await loadDetail(boardId);
  }

  async function patchTask(
    taskId: string,
    body: Record<string, unknown>,
    options?: { reloadOnSuccess?: boolean }
  ): Promise<boolean> {
    const reloadOnSuccess = options?.reloadOnSuccess !== false;
    const r = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return false;
    if (reloadOnSuccess && boardId) await loadDetail(boardId);
    return true;
  }

  const persistTaskOrder = useCallback(
    async (snapshot: BoardDetail) => {
      try {
        const r = await fetch(
          `/api/planner/boards/${encodeURIComponent(snapshot.id)}/reorder-tasks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              columns: snapshot.columns.map((c) => ({
                columnId: c.id,
                taskIds: c.tasks.map((t) => t.id),
              })),
            }),
          }
        );
        if (!r.ok && boardId) await loadDetail(boardId);
      } catch {
        if (boardId) await loadDetail(boardId);
      }
    },
    [boardId, loadDetail]
  );

  function setBoardInStore(board: BoardDetail) {
    setBoardDetailsById((prev) => ({ ...prev, [board.id]: board }));
    if (boardId === board.id || detail?.id === board.id) setDetail(board);
  }

  async function persistTaskMove(
    taskId: string,
    destColumnId: string,
    insertBeforeTaskId: string | null
  ) {
    if (moveInFlightRef.current) return;
    moveInFlightRef.current = true;
    clearDragState();
    try {
      const r = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: destColumnId, insertBeforeTaskId }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        window.alert((j as { error?: string }).error || "Could not move task");
        if (allBoardsView) await loadAllBoardDetails();
        else if (boardId) await loadDetail(boardId);
        return;
      }
      if (allBoardsView) await loadAllBoardDetails();
      else if (boardId) await loadDetail(boardId);
      await refreshBoards();
    } finally {
      moveInFlightRef.current = false;
    }
  }

  /** Optimistic UI, then single move API (same-board and cross-board). */
  function reorderTasksAndPersist(
    snapshot: BoardDetail,
    taskId: string,
    destColumnId: string,
    insertBeforeTaskId: string | null
  ) {
    if (moveInFlightRef.current) return;

    const onSameBoard = snapshot.columns.some((c) => c.id === destColumnId);
    if (onSameBoard) {
      const nextDetail = boardDetailAfterMovingTask(
        snapshot,
        taskId,
        destColumnId,
        insertBeforeTaskId
      );
      setBoardInStore(nextDetail as BoardDetail);
      void persistTaskMove(taskId, destColumnId, insertBeforeTaskId);
      return;
    }

    const store = {
      ...boardsDetailRef.current,
      ...(detailRef.current ? { [detailRef.current.id]: detailRef.current } : {}),
    };
    const destBoardId = findBoardIdForColumn(store, destColumnId);
    const destBoard = destBoardId ? store[destBoardId] : null;
    if (!destBoard?.editable) return;

    const { source, dest } = boardDetailAfterCrossBoardMove(
      snapshot,
      destBoard as KanbanBoardDetail,
      taskId,
      destColumnId,
      insertBeforeTaskId
    );
    setBoardInStore(source as BoardDetail);
    setBoardInStore(dest as BoardDetail);
    void persistTaskMove(taskId, destColumnId, insertBeforeTaskId);
  }

  async function moveTaskUniversal(
    taskId: string,
    destColumnId: string,
    insertBeforeTaskId: string | null
  ) {
    const source =
      findBoardContainingTask(boardsDetailRef.current, detailRef.current, taskId) ??
      detailRef.current;
    if (!source) return;
    reorderTasksAndPersist(source, taskId, destColumnId, insertBeforeTaskId);
  }

  async function onDropBoardTab(targetBoardId: string, dataTransfer?: DataTransfer | null) {
    const taskId = resolveDraggedTaskId(dataTransfer)?.trim() || null;
    clearDragState();
    if (!taskId || targetBoardId === boardId) return;

    let target: BoardDetail | null = boardDetailsById[targetBoardId] ?? null;
    if (!target) {
      target = await loadDetail(targetBoardId);
    }
    if (!target?.editable) return;
    const backlogId = resolveBacklogColumnId(target.columns);
    if (!backlogId) return;

    const source =
      findBoardContainingTask(boardsDetailRef.current, detailRef.current, taskId) ?? detailRef.current;
    if (!source) return;
    reorderTasksAndPersist(source, taskId, backlogId, null);
    setBoardId(targetBoardId);
  }

  function resolveDraggedTaskId(dataTransfer?: DataTransfer | null) {
    return (
      dragTaskIdRef.current ||
      dragTaskId ||
      dataTransfer?.getData("text/plain")?.trim() ||
      null
    );
  }

  async function onDropColumn(columnId: string, dataTransfer?: DataTransfer | null) {
    const taskId = resolveDraggedTaskId(dataTransfer)?.trim() || null;
    if (!taskId) {
      clearDragState();
      return;
    }

    const source = findBoardContainingTask(boardsDetailRef.current, detailRef.current, taskId);
    if (!source?.editable) return;
    const mergedStore = {
      ...boardsDetailRef.current,
      ...(detailRef.current ? { [detailRef.current.id]: detailRef.current } : {}),
    };
    const destBoardId = findBoardIdForColumn(mergedStore, columnId);
    const dest = destBoardId ? mergedStore[destBoardId] : null;
    if (dest && !dest.editable) return;

    reorderTasksAndPersist(source, taskId, columnId, null);
  }

  /** Drop onto a card outline: insert relative to midpoint. */
  function onDropCard(columnId: string, anchorTaskId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const taskIdRaw = resolveDraggedTaskId(e.dataTransfer)?.trim() || null;
    if (!taskIdRaw || anchorTaskId === taskIdRaw) {
      clearDragState();
      return;
    }

    const source = findBoardContainingTask(boardsDetailRef.current, detailRef.current, taskIdRaw);
    if (!source?.editable) return;

    const mergedStore = {
      ...boardsDetailRef.current,
      ...(detailRef.current ? { [detailRef.current.id]: detailRef.current } : {}),
    };
    const destBoardId = findBoardIdForColumn(mergedStore, columnId);
    const destBoard = destBoardId ? mergedStore[destBoardId] : source;
    const col = destBoard?.columns.find((c) => c.id === columnId);
    if (!col) return;

    const placement = taskCardDropPlacement(e, e.currentTarget as HTMLElement);
    const beforeId = insertAnchorBeforeId(col.tasks, anchorTaskId, placement, taskIdRaw);

    reorderTasksAndPersist(source, taskIdRaw, columnId, beforeId);
  }

  /** Hits the flex gutter between cards — insert before anchor task without relying on midpoint. */
  function onDropInsertRail(columnId: string, insertBeforeTaskId: string | null, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const taskIdRaw = resolveDraggedTaskId(e.dataTransfer)?.trim() || null;
    if (!taskIdRaw) {
      clearDragState();
      return;
    }

    const source = findBoardContainingTask(boardsDetailRef.current, detailRef.current, taskIdRaw);
    if (!source?.editable) return;

    reorderTasksAndPersist(source, taskIdRaw, columnId, insertBeforeTaskId);
  }

  async function createLabel(name: string, color: string) {
    if (!boardId) return;
    await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await loadDetail(boardId);
  }

  async function patchLabel(labelId: string, patch: { name?: string; color?: string }): Promise<boolean> {
    const r = await fetch(`/api/planner/labels/${encodeURIComponent(labelId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert((j as { error?: string }).error || "Could not update label");
      return false;
    }
    if (boardId) await loadDetail(boardId);
    return true;
  }

  async function deleteLabel(labelId: string) {
    const r = await fetch(`/api/planner/labels/${encodeURIComponent(labelId)}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert((j as { error?: string }).error || "Could not delete label");
      return;
    }
    if (boardId) await loadDetail(boardId);
  }

  async function addMember(userId: string, role: "editor" | "viewer") {
    if (!boardId) return;
    await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    await loadDetail(boardId);
  }

  async function removeMember(userId: string) {
    if (!boardId) return;
    await fetch(
      `/api/planner/boards/${encodeURIComponent(boardId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    await loadDetail(boardId);
  }

  async function patchColumnApi(id: string, patch: Record<string, unknown>) {
    return fetch(`/api/planner/columns/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function patchColumn(id: string, patch: Record<string, unknown>) {
    const r = await patchColumnApi(id, patch);
    if (r.ok && boardId) await loadDetail(boardId);
  }

  async function patchBoardApi(id: string, patch: Record<string, unknown>) {
    return fetch(`/api/planner/boards/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function reorderBoards(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= filteredBoards.length) return;
    const a = filteredBoards[fromIdx];
    const b = filteredBoards[toIdx];
    if (!a || !b || FIXED_BOARD_KINDS.has(a.kind ?? "custom") || FIXED_BOARD_KINDS.has(b.kind ?? "custom"))
      return;
    const next = [...boards];
    const ai = next.findIndex((x) => x.id === a.id);
    const bi = next.findIndex((x) => x.id === b.id);
    if (ai < 0 || bi < 0) return;
    next[ai] = { ...b, sortOrder: a.sortOrder };
    next[bi] = { ...a, sortOrder: b.sortOrder };
    setBoards(next);
    const [r1, r2] = await Promise.all([
      patchBoardApi(a.id, { sortOrder: b.sortOrder }),
      patchBoardApi(b.id, { sortOrder: a.sortOrder }),
    ]);
    if (!r1.ok || !r2.ok) await refreshBoards();
  }

  async function reorderColumns(fromIdx: number, toIdx: number) {
    if (!detail || !boardId || toIdx < 0 || toIdx >= detail.columns.length) return;
    const a = detail.columns[fromIdx];
    const b = detail.columns[toIdx];
    if (!a || !b) return;
    const nextCols = [...detail.columns];
    nextCols[fromIdx] = { ...b, sortOrder: a.sortOrder };
    nextCols[toIdx] = { ...a, sortOrder: b.sortOrder };
    setDetail({ ...detail, columns: nextCols });

    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;
    const [r1, r2] = await Promise.all([
      patchColumnApi(a.id, { sortOrder: bOrder }),
      patchColumnApi(b.id, { sortOrder: aOrder }),
    ]);
    if (!r1.ok || !r2.ok) await loadDetail(boardId);
  }

  async function addColumn() {
    if (!boardId || !newColTitle.trim()) return;
    const r = await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newColTitle.trim(),
        color: newColColor,
        linkedLabelName: newColLinkedLabel || null,
      }),
    });
    if (r.ok) {
      setNewColTitle("");
      setNewColColor("#64748b");
      setNewColLinkedLabel("");
      setAddColumnOpen(false);
      await loadDetail(boardId);
    }
  }

  async function deleteColumn(columnId: string) {
    const r = await fetch(`/api/planner/columns/${encodeURIComponent(columnId)}`, {
      method: "DELETE",
    });
    if (r.ok && boardId) await loadDetail(boardId);
    else if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert(j?.error || "Could not delete column");
    }
  }

  const icsUrl =
    typeof window !== "undefined" && boardId
      ? `${window.location.origin}/api/planner/boards/${encodeURIComponent(boardId)}/calendar`
      : "";

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading planner…</p>;
  }

  return (
    <div className="space-y-6">
      {showHub ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => goPlanner({ area: "personal" })}
            className="card-tool rounded-xl p-6 text-left ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.04]"
          >
            <p className="text-lg font-semibold text-white">Personal</p>
            <p className="mt-2 text-sm text-slate-400">
              Your boards, including Blocharch Outbox when you are admin.
            </p>
          </button>
          {canUseTeamRoster ? (
            <button
              type="button"
              onClick={() => goPlanner({ area: "team" })}
              className="card-tool rounded-xl p-6 text-left ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.04]"
            >
              <p className="text-lg font-semibold text-white">Team</p>
              <p className="mt-2 text-sm text-slate-400">
                Pick an athlete to open their workspace and Kanban boards.
              </p>
            </button>
          ) : null}
        </div>
      ) : null}

      {showTeamRoster ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goPlanner({})}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              ← Project planner
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-sm font-medium text-slate-300">Team</span>
          </div>
          <p className="text-sm text-slate-400">Select an athlete to view their workspace boards.</p>
          {teamAthletesLoading ? (
            <p className="text-sm text-slate-500">Loading athletes…</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {teamAthletes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => goPlanner({ area: "team", athlete: a.userId })}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <ClientAvatar name={a.fullName} logoUrl={a.profilePhotoUrl} backgroundColor={a.profilePhotoBgColor} textTone={asAvatarTextTone(a.profilePhotoTextTone)} size={36} objectFit="cover" />
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-100">{a.fullName}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {a.athleteCode} · {a.activeProjects} active project
                        {a.activeProjects === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!teamAthletesLoading && teamAthletes.length === 0 ? (
            <p className="text-sm text-slate-500">No active athletes yet.</p>
          ) : null}
        </div>
      ) : null}

      {showBoardPicker ? (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => goPlanner({})}
            className="text-slate-500 hover:text-slate-300"
          >
            Project planner
          </button>
          <span className="text-slate-600">/</span>
          <button
            type="button"
            onClick={() =>
              goPlanner(area === "team" ? { area: "team" } : { area: "personal" })
            }
            className="text-slate-400 hover:text-slate-200"
          >
            {area === "team" ? "Team" : "Personal"}
          </button>
          {area === "team" && selectedAthleteName ? (
            <>
              <span className="text-slate-600">/</span>
              <span className="font-medium text-slate-200">{selectedAthleteName}</span>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setNewBoardOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          New board
        </button>
      </div>
      ) : null}

      {showBoardPicker && newBoardOpen && (
        <form
          onSubmit={createBoard}
          className="card-tool flex flex-wrap items-end gap-3 rounded-xl p-4"
        >
          <label className="text-xs text-slate-400">
            Title
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 block w-56 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              placeholder="Q1 pipeline"
            />
          </label>
          <label className="text-xs text-slate-400">
            Scope
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as "personal" | "team")}
              className="select-console mt-1 block rounded-md px-3 py-2 text-sm"
            >
              <option value="personal">Personal</option>
              <option value="team">Team</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Board color
            <input
              type="color"
              value={newBoardColor}
              onChange={(e) => setNewBoardColor(e.target.value)}
              className="mt-1 block h-10 w-14 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
            />
          </label>
          <button type="submit" className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100">
            Create
          </button>
          <button
            type="button"
            onClick={() => setNewBoardOpen(false)}
            className="text-sm text-slate-500"
          >
            Cancel
          </button>
        </form>
      )}

      {showBoardPicker ? (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filteredBoards.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                const next = !allBoardsView;
                setAllBoardsView(next);
                if (next) void loadAllBoardDetails();
              }}
              className={`planner-tab rounded-lg border px-3 py-2 text-xs font-medium ${
                allBoardsView
                  ? "planner-tab-selected border-brand-500/40 bg-brand-500/10 text-brand-200"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400"
              }`}
            >
              {allBoardsView ? "All boards (on)" : "All boards"}
            </button>
          ) : null}
          {dragTaskId ? (
            <p className="text-xs text-brand-300">Drop on another board tab or column to move across boards</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filteredBoards.map((b, boardIdx) => {
            const inboxUnread = b.kind === "blocharch_inbox" && inboxUnreadCount > 0;
            return (
            <div key={b.id} className="flex items-center gap-0.5">
              {!FIXED_BOARD_KINDS.has(b.kind ?? "custom") && filteredBoards.length > 1 ? (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    title="Move board left"
                    disabled={boardIdx === 0 || !!dragTaskId}
                    onClick={() => void reorderBoards(boardIdx, boardIdx - 1)}
                    className="rounded px-1 text-[10px] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    title="Move board right"
                    disabled={boardIdx >= filteredBoards.length - 1 || !!dragTaskId}
                    onClick={() => void reorderBoards(boardIdx, boardIdx + 1)}
                    className="rounded px-1 text-[10px] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              ) : null}
            <button
              type="button"
              onClick={() => {
                if (!dragTaskId) setBoardId(b.id);
              }}
              onDragOver={(e) => {
                if (!dragTaskId || b.id === boardId || b.kind === "blocharch_outbox") return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTargetBoardId(b.id);
              }}
              onDragLeave={() => setDropTargetBoardId((prev) => (prev === b.id ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                void onDropBoardTab(b.id, e.dataTransfer);
              }}
              className={`planner-tab rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                boardId === b.id && !allBoardsView
                  ? "planner-tab-selected border-brand-500/40 bg-brand-500/10 text-brand-100"
                  : dropTargetBoardId === b.id
                    ? "planner-tab-selected border-brand-500/50 bg-brand-500/15 text-brand-100 ring-2 ring-brand-500/30"
                    : inboxUnread
                      ? "planner-tab-alert animate-pulse border-red-500/40 bg-red-500/10 text-red-100 ring-1 ring-red-500/35"
                      : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
              style={{ borderLeftWidth: 4, borderLeftColor: b.color }}
            >
              <span className="font-medium">{b.title}</span>
              {inboxUnread ? (
                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                </span>
              ) : null}
              {b.isSystem && !isAthleteSelfView ? (
                <span className="ml-2 text-[10px] uppercase text-amber-500/80">fixed</span>
              ) : !b.isSystem ? (
                <span className="ml-2 text-[10px] uppercase text-slate-500">{b.scope}</span>
              ) : null}
            </button>
            </div>
            );
          })}
          {filteredBoards.length === 0 ? (
            <p className="text-sm text-slate-500">No boards yet — create one to get started.</p>
          ) : null}
        </div>
      </div>
      ) : null}

      {showBoardPicker ? (
      <>
      {detail?.kind === "blocharch_outbox" ? <BlocharchOutboxPanel /> : null}

      {allBoardsView && showBoardPicker ? (
        <div className="space-y-3">
          {boardsLoading ? (
            <p className="text-sm text-slate-500">Loading all boards…</p>
          ) : multiBoardList.length > 0 ? (
            <MultiBoardKanban
              boards={multiBoardList as KanbanBoardDetail[]}
              onMoveTask={moveTaskUniversal}
              onNudgeTask={nudgeTaskOnBoard}
              onOpenTask={(task, columnId, openBoardId) => {
                setBoardId(openBoardId);
                setEditTask({ ...task, columnId });
              }}
              onToggleComplete={(taskId, completed) => void toggleTaskCompleted(taskId, completed)}
              hideFixedBadge={isAthleteSelfView}
            />
          ) : (
            <p className="text-sm text-slate-500">No boards to show.</p>
          )}
        </div>
      ) : null}

      {detail && detail.kind !== "blocharch_outbox" && !allBoardsView ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
              <p className="text-xs text-slate-500">
                {detail.scope === "team" ? "Team board" : "Personal board"} · Owner{" "}
                {detail.owner.username}
                {!detail.editable ? " · View only" : ""}
                {detail.editable ? (
                  <>
                    {" "}
                    · Drag cards between columns and boards (use All boards view or drop on board tabs).
                    Use the ↑↓←→ pad on each card (or arrow keys when focused) if drag-and-drop is unreliable.
                    Single-click selects a card; double-click opens it.
                    {completedColumnId ? (
                      <>
                        {" "}
                        Done checkbox moves to Done/Completed (or the last column when there isn’t one
                        titled Done).
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.editable && !isAthleteSelfView ? (
                <>
                  <button
                    type="button"
                    onClick={() => void renameBoard(detail.id, detail.title)}
                    className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                  >
                    Rename board
                  </button>
                  {!detail.isSystem ? (
                    <button
                      type="button"
                      onClick={() => void deleteBoard(detail.id, detail.title)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15"
                    >
                      Delete board
                    </button>
                  ) : null}
                </>
              ) : null}
              {icsUrl && !isAthleteSelfView ? (
                <a
                  href={icsUrl}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                >
                  Download calendar (.ics)
                </a>
              ) : null}
            </div>
          </div>

          {detail.canManageMembers && detail.scope === "team" && (
            <div className="card-tool rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Team access
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Editors move cards; viewers see only. Managers and admins can open all team boards.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <MemberAddForm assignees={assignees} onAdd={addMember} currentIds={detail.members.map((m) => m.userId)} />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-400">
                {detail.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span>
                      {m.user.username}{" "}
                      <span className="text-xs text-slate-600">({m.role})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(m.userId)}
                      className="text-xs text-red-400/90 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.editable && (
            <div className="card-tool rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Labels</p>
              <p className="mt-1 text-[11px] text-slate-600">
                {isAthleteSelfView
                  ? "Task tags on this board."
                  : "Edit name or colour anytime. Deleting removes the tag from every task on this board."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {detail.labels.map((l) => (
                  <EditableLabelChip
                    key={l.id}
                    label={l}
                    readOnly={isAthleteSelfView}
                    onPatch={patchLabel}
                    onDelete={deleteLabel}
                  />
                ))}
                {!isAthleteSelfView ? <LabelInlineForm onCreate={createLabel} /> : null}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
          <div
            className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-4"
            data-planner-scroll-x
          >
            {detail.columns.map((col, colIdx) => (
              <div
                key={col.id}
                className={`planner-kanban-column flex w-[min(78vw,280px)] shrink-0 flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] transition-[box-shadow,background-color,border-color] duration-150 sm:w-[280px] ${
                  detail.editable && dragTaskId && dropTargetColumnId === col.id
                    ? "border-brand-500/35 bg-brand-500/[0.07] ring-2 ring-brand-500/25"
                    : ""
                }`}
                onDragOver={(e) => {
                  if (!detail.editable || !dragTaskIdRef.current) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  trackDragPointer(e.clientX, e.clientY);
                  startDragAutoScroll();
                  scheduleDragHighlight(col.id, null);
                }}
                onDragLeave={(e) => {
                  if (!detail.editable || !dragTaskIdRef.current) return;
                  const related = e.relatedTarget as Node | null;
                  if (related && e.currentTarget.contains(related)) return;
                  scheduleDragHighlight(null, null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDropColumn(col.id, e.dataTransfer);
                }}
              >
                <EditableColumnHeader
                  column={col}
                  editable={detail.editable}
                  colIndex={colIdx}
                  totalColumns={detail.columns.length}
                  onPatch={patchColumn}
                  onDelete={deleteColumn}
                  onReorder={reorderColumns}
                />
                <div
                  data-planner-scroll-y
                  className={`flex min-h-[160px] max-h-[min(70vh,720px)] flex-1 flex-col space-y-3 overflow-y-auto overscroll-y-contain p-2 transition-colors duration-150 ${
                    detail.editable && dragTaskId && dropTargetColumnId === col.id
                      ? "rounded-lg bg-brand-500/[0.06]"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    if (!detail.editable || !dragTaskIdRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                    trackDragPointer(e.clientX, e.clientY);
                  startDragAutoScroll();
                    scheduleDragHighlight(col.id, { columnId: col.id, beforeTaskId: null });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDropColumn(col.id, e.dataTransfer);
                  }}
                >
                  {col.tasks.map((t) => {
                    const descPreview = taskCardDescriptionPreview(t.description);
                    const showDoneTick =
                      detail.editable &&
                      completedColumnId !== null &&
                      detail.columns.length >= 2;
                    const isInDoneColumn = col.id === completedColumnId;
                    const isSelected = selectedTaskId === t.id;
                    const nudge = detail.editable
                      ? taskNudgeAvailability(detail.columns, t.id)
                      : null;
                    const showInboxMove =
                      detail.kind === "blocharch_inbox" && detail.editable && inboxMoveTargets.length > 0;
                    const showInsertLine =
                      detail.editable &&
                      dragTaskId &&
                      dragTaskId !== t.id &&
                      taskDropGuide?.columnId === col.id &&
                      taskDropGuide.beforeTaskId === t.id;

                    return (
                      <Fragment key={t.id}>
                        {showInsertLine ? (
                          <div
                            role="presentation"
                            aria-hidden
                            className="-mx-0.5 h-0.5 shrink-0 rounded-full bg-brand-400/85 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                          />
                        ) : null}
                      {detail.editable && dragTaskId && dragTaskId !== t.id ? (
                        <div
                          role="separator"
                          aria-orientation="horizontal"
                          aria-label="Drop to insert row here"
                          className={`h-[12px] shrink-0 rounded-md border transition-colors md:h-[14px] ${
                            dragTaskId && taskDropGuide?.columnId === col.id && taskDropGuide.beforeTaskId === t.id
                              ? "border-brand-400/50 bg-brand-500/15"
                              : "border-transparent bg-transparent hover:border-brand-500/25 hover:bg-brand-500/10"
                          }`}
                          onDragOver={(e) => {
                            if (!dragTaskIdRef.current) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = "move";
                            scheduleDragHighlight(col.id, { columnId: col.id, beforeTaskId: t.id });
                          }}
                          onDrop={(e) => {
                            onDropInsertRail(col.id, t.id, e);
                          }}
                        />
                      ) : null}
                      <div
                        role="button"
                        tabIndex={0}
                        draggable={detail.editable}
                        onDragStart={(e) => {
                          if (!detail.editable) return;
                          suppressNextCardClickRef.current = false;
                          dragTaskIdRef.current = t.id;
                          setDragTaskId(t.id);
                          startDragAutoScroll();
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", t.id);
                          removePlannerDragGhosts();
                          if (dragGhostRef.current) {
                            dragGhostRef.current.remove();
                            dragGhostRef.current = null;
                          }
                          const card = e.currentTarget;
                          try {
                            const ghost = card.cloneNode(true) as HTMLElement;
                            ghost.setAttribute("data-planner-drag-ghost", "true");
                            ghost.style.width = `${card.offsetWidth}px`;
                            ghost.style.opacity = "0.92";
                            ghost.style.transform = "rotate(2deg)";
                            ghost.style.boxShadow = "0 12px 40px rgba(0,0,0,0.45)";
                            ghost.style.borderRadius = "0.5rem";
                            ghost.style.pointerEvents = "none";
                            ghost.style.position = "fixed";
                            ghost.style.top = "-10000px";
                            ghost.style.left = "-10000px";
                            ghost.style.zIndex = "-1";
                            document.body.appendChild(ghost);
                            dragGhostRef.current = ghost;
                            e.dataTransfer.setDragImage(
                              ghost,
                              e.clientX - card.getBoundingClientRect().left,
                              e.clientY - card.getBoundingClientRect().top
                            );
                            requestAnimationFrame(() =>
                              requestAnimationFrame(() => {
                                if (dragGhostRef.current === ghost) {
                                  ghost.remove();
                                  dragGhostRef.current = null;
                                }
                              })
                            );
                          } catch {
                            /* setDragImage unsupported — fallback to default preview */
                          }
                        }}
                        onDragEnd={() => {
                          if (dragGhostRef.current) {
                            dragGhostRef.current.remove();
                            dragGhostRef.current = null;
                          }
                          removePlannerDragGhosts();
                          suppressNextCardClickRef.current = true;
                        }}
                        onDragOver={(e) => {
                          if (!detail.editable || !dragTaskIdRef.current || dragTaskIdRef.current === t.id)
                            return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          const placement = taskCardDropPlacement(e, e.currentTarget as HTMLElement);
                          const guideBeforeId = insertAnchorBeforeId(
                            col.tasks,
                            t.id,
                            placement,
                            dragTaskIdRef.current
                          );
                          scheduleDragHighlight(col.id, {
                            columnId: col.id,
                            beforeTaskId: guideBeforeId,
                          });
                        }}
                        onDrop={(e) => {
                          onDropCard(col.id, t.id, e);
                        }}
                        onClick={() => {
                          if (suppressNextCardClickRef.current) {
                            suppressNextCardClickRef.current = false;
                            return;
                          }
                          setSelectedTaskId(t.id);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedTaskId(t.id);
                          setEditTask({ ...t, columnId: col.id });
                        }}
                        onKeyDown={(e) => {
                          if (detail.editable) {
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
                              nudgeTask(t.id, dir);
                              return;
                            }
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (isSelected) {
                              setEditTask({ ...t, columnId: col.id });
                            } else {
                              setSelectedTaskId(t.id);
                            }
                          }
                        }}
                        className={`planner-task-card w-full rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 text-left text-sm text-slate-200 outline-none transition-[opacity,transform,box-shadow] duration-150 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
                          detail.editable ? "cursor-pointer" : "cursor-pointer"
                        } ${
                          isSelected ? "ring-2 ring-brand-500/45 bg-brand-500/[0.08]" : ""
                        } ${
                          dragTaskId === t.id
                            ? "opacity-35 scale-[0.985] shadow-inner ring-1 ring-brand-500/30"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {showDoneTick ? (
                            <PlannerDoneToggle
                              checked={isInDoneColumn}
                              title={isInDoneColumn ? "Restore to previous column" : "Mark complete"}
                              onToggle={(next) => void toggleTaskCompleted(t.id, next)}
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{t.title}</p>
                            {t.linkedFromTaskId ? (
                              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-400/85">
                                From another board · edit your personal copy here
                              </p>
                            ) : null}
                            {descPreview ? (
                              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[12px] leading-snug text-slate-400">
                                {descPreview}
                              </p>
                            ) : null}
                            {t.labels.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {t.labels.map((x) => (
                                  <PlannerLabelChip
                                    key={x.label.id}
                                    name={x.label.name}
                                    color={x.label.color}
                                  />
                                ))}
                              </div>
                            ) : null}
                            {showInboxMove ? (
                              <div
                                className="mt-2"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => openInboxMoveModal(t.id, t.title)}
                                  className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-[10px] font-medium text-brand-200 hover:bg-brand-500/20"
                                >
                                  Move to board…
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {nudge ? (
                            <KanbanTaskMovePad
                              onNudge={(dir) => nudgeTask(t.id, dir)}
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
                  {detail.editable && dragTaskId && col.tasks.length > 0 ? (
                    <div
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Drop to add at bottom of column"
                      className={`h-[14px] shrink-0 rounded-md border transition-colors ${
                        taskDropGuide?.columnId === col.id && taskDropGuide.beforeTaskId === null
                          ? "border-brand-400/50 bg-brand-500/15"
                          : "border-transparent hover:border-brand-500/25 hover:bg-brand-500/10"
                      }`}
                      onDragOver={(e) => {
                        if (!dragTaskIdRef.current) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        scheduleDragHighlight(col.id, { columnId: col.id, beforeTaskId: null });
                      }}
                      onDrop={(e) => {
                        onDropInsertRail(col.id, null, e);
                      }}
                    />
                  ) : null}
                  {detail.editable && (
                    <button
                      type="button"
                      onClick={() => setTaskOpen({ columnId: col.id })}
                      className="rounded-lg border border-dashed border-white/[0.12] py-2 text-xs text-slate-500 hover:border-brand-500/30 hover:text-brand-300"
                    >
                      + Add task
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
            {detail.editable ? (
              <div className="flex w-[min(78vw,260px)] shrink-0 flex-col gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-3 sm:w-[260px]">
                {!addColumnOpen ? (
                  <button
                    type="button"
                    onClick={() => setAddColumnOpen(true)}
                    className="rounded-lg py-8 text-sm text-slate-500 hover:text-brand-300"
                  >
                    + Add column
                  </button>
                ) : (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addColumn();
                    }}
                  >
                    <p className="text-xs font-medium text-slate-400">New column</p>
                    <input
                      required
                      value={newColTitle}
                      onChange={(e) => setNewColTitle(e.target.value)}
                      placeholder="Column title"
                      className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-sm text-white"
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        Colour
                        <input
                          type="color"
                          value={newColColor}
                          onChange={(e) => setNewColColor(e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
                        />
                      </label>
                    </div>
                    <label className="text-xs text-slate-500">
                      Link to label (optional)
                      <select
                        value={newColLinkedLabel}
                        onChange={(e) => setNewColLinkedLabel(e.target.value)}
                        className="select-console mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
                      >
                        <option value="">None — manual column</option>
                        {APPROVED_PLANNER_LABELS.map((l) => (
                          <option key={l.name} value={l.name}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddColumnOpen(false);
                          setNewColTitle("");
                        }}
                        className="text-xs text-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>

          {taskOpen && detail.editable && (
            <TaskFormModal
              labels={detail.labels}
              assignees={assignees}
              showAssignee={currentRole === "admin" || currentRole === "manager"}
              onClose={() => setTaskOpen(null)}
              onSave={async (payload) => {
                await addTask(taskOpen.columnId, payload);
                setTaskOpen(null);
              }}
            />
          )}

          {editTask && detail && (
            <EditTaskModal
              key={editTask.id}
              readOnly={!detail.editable}
              task={editTask}
              labels={detail.labels}
              assignees={assignees}
              showAssignee={currentRole === "admin" || currentRole === "manager"}
              onClose={() => {
                setEditTask(null);
                setSelectedTaskId(null);
              }}
              onSave={async (taskId, payload) => {
                await patchTask(taskId, payload);
                setEditTask(null);
                setSelectedTaskId(null);
              }}
              onDelete={async (taskId) => {
                await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
                setEditTask(null);
                setSelectedTaskId(null);
                if (boardId) await loadDetail(boardId);
              }}
            />
          )}
        </>
      ) : null}
      </>
      ) : null}

      {moveModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-panel w-full max-w-md rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Move to board</h3>
            <p className="mt-1 text-xs text-slate-500">
              Route this inbox task to a working board. It will land in the column linked to its
              label, or the default column if none matches.
            </p>
            <p className="mt-2 text-sm text-slate-300">{moveModal.title}</p>
            {inboxMoveTargets.length === 0 ? (
              <p className="mt-4 text-sm text-amber-400/90">No destination boards available.</p>
            ) : (
              <label className="mt-4 block text-xs text-slate-400">
                Destination board
                <select
                  value={moveBoardId ?? ""}
                  onChange={(e) => setMoveBoardId(e.target.value || null)}
                  className="select-console mt-1 block w-full rounded-lg px-3 py-2 text-sm"
                >
                  {inboxMoveTargets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModal(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={moveSaving || !moveBoardId || inboxMoveTargets.length === 0}
                onClick={() => void confirmMoveToBoard()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
              >
                {moveSaving ? "Moving…" : "Move"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditableColumnHeader({
  column,
  editable,
  colIndex,
  totalColumns,
  onPatch,
  onDelete,
  onReorder,
}: {
  column: ColumnRow;
  editable: boolean;
  colIndex: number;
  totalColumns: number;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (from: number, to: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [color, setColor] = useState(column.color);
  const [linkedLabel, setLinkedLabel] = useState(column.linkedLabelName ?? "");

  useEffect(() => {
    setTitle(column.title);
    setColor(column.color);
    setLinkedLabel(column.linkedLabelName ?? "");
  }, [column.id, column.title, column.color, column.linkedLabelName]);

  const canMoveLeft = colIndex > 0;
  const canMoveRight = colIndex < totalColumns - 1;
  const canDelete = totalColumns > 1 && column.tasks.length === 0;

  if (!editable) {
    return (
      <div
        className="border-b border-white/[0.06] px-3 py-2"
        style={{ borderTopWidth: 3, borderTopColor: column.color }}
      >
        <p className="text-sm font-semibold text-slate-200">{column.title}</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div
        className="border-b border-white/[0.06] px-2 py-2"
        style={{ borderTopWidth: 3, borderTopColor: color }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field-console mb-2 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
          autoFocus
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Colour
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent"
            />
          </label>
          <label className="mb-2 block text-xs text-slate-500">
            Link to label (optional)
            <select
              value={linkedLabel}
              onChange={(e) => setLinkedLabel(e.target.value)}
              className="select-console mt-1 block w-full rounded px-2 py-1 text-sm"
            >
              <option value="">None — manual column</option>
              {APPROVED_PLANNER_LABELS.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const t = title.trim();
                if (!t) return;
                await onPatch(column.id, {
                  title: t,
                  color,
                  linkedLabelName: linkedLabel || null,
                });
                setEditing(false);
              }}
              className="rounded bg-brand-600 px-2 py-1 text-xs font-semibold text-slate-950"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-b border-white/[0.06] px-2 py-1.5"
      style={{ borderTopWidth: 3, borderTopColor: column.color }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
          {column.title}
          {column.linkedLabelName ? (
            <span className="ml-1 text-[10px] font-normal text-brand-400/90">
              · {column.linkedLabelName}
            </span>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Move left"
            disabled={!canMoveLeft}
            onClick={() => onReorder(colIndex, colIndex - 1)}
            className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200 disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            title="Move right"
            disabled={!canMoveRight}
            onClick={() => onReorder(colIndex, colIndex + 1)}
            className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200 disabled:opacity-30"
          >
            →
          </button>
          <button
            type="button"
            title="Edit column"
            onClick={() => setEditing(true)}
            className="rounded px-1.5 py-0.5 text-xs text-brand-400 hover:bg-white/10"
          >
            Edit
          </button>
        </div>
      </div>
      {canDelete ? (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this empty column?")) void onDelete(column.id);
          }}
          className="mt-1 text-[10px] text-red-400/80 hover:text-red-300"
        >
          Delete column
        </button>
      ) : null}
    </div>
  );
}

function EditableLabelChip({
  label,
  readOnly = false,
  onPatch,
  onDelete,
}: {
  label: Label;
  readOnly?: boolean;
  onPatch: (id: string, patch: { name: string; color: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  useEffect(() => {
    setName(label.name);
    setColor(label.color);
  }, [label.id, label.name, label.color]);

  if (readOnly) {
    return (
      <div
        className="flex max-w-full items-center rounded-full py-0.5 px-2.5 planner-label-chip ring-1 ring-inset"
        style={plannerLabelChipStyle(label.color)}
      >
        <span className="max-w-[10rem] truncate text-xs font-semibold" title={label.name}>
          {label.name}
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          const ok = await onPatch(label.id, { name: n, color });
          if (ok) setEditing(false);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-console w-28 rounded border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-white"
          autoFocus
          maxLength={64}
        />
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
          Colour
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
          />
        </label>
        <button type="submit" className="text-xs font-semibold text-brand-400 hover:text-brand-300">
          Save
        </button>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => {
            setEditing(false);
            setName(label.name);
            setColor(label.color);
          }}
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div
      className="flex max-w-full items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 planner-label-chip ring-1 ring-inset"
      style={plannerLabelChipStyle(label.color)}
    >
      <span className="max-w-[10rem] truncate text-xs font-semibold" title={label.name}>
        {label.name}
      </span>
      <button
        type="button"
        title="Edit label"
        onClick={() => setEditing(true)}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-brand-400 hover:bg-white/10"
      >
        Edit
      </button>
      <button
        type="button"
        title="Delete label"
        onClick={() => {
          if (
            window.confirm(
              `Delete label "${label.name}"? It will be removed from all tasks on this board.`
            )
          ) {
            void onDelete(label.id);
          }
        }}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-red-400/90 hover:bg-white/10"
      >
        Delete
      </button>
    </div>
  );
}

function LabelInlineForm({ onCreate }: { onCreate: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-slate-500"
      >
        + Label
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(name.trim(), color);
        setName("");
        setOpen(false);
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Label"
        className="field-console w-24 rounded border border-white/10 bg-black/30 px-2 py-0.5 text-xs"
      />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0" />
      <button type="submit" className="text-xs text-brand-400">
        Add
      </button>
    </form>
  );
}

function MemberAddForm({
  assignees,
  onAdd,
  currentIds,
}: {
  assignees: AssigneeOption[];
  onAdd: (userId: string, role: "editor" | "viewer") => void;
  currentIds: string[];
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const options = assignees.filter((u) => !currentIds.includes(u.id));
  return (
    <>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="select-console rounded-md px-2 py-1.5 text-xs text-slate-100"
      >
        <option value="">Add teammate…</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.username}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
        className="select-console rounded-md px-2 py-1.5 text-xs text-slate-100"
      >
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
      <button
        type="button"
        disabled={!userId}
        onClick={() => {
          if (userId) onAdd(userId, role);
          setUserId("");
        }}
        className="rounded-md bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-100 disabled:opacity-50"
      >
        Add
      </button>
    </>
  );
}

function TaskFormModal({
  labels,
  assignees,
  showAssignee = true,
  onClose,
  onSave,
}: {
  labels: Label[];
  assignees: AssigneeOption[];
  showAssignee?: boolean;
  onClose: () => void;
  onSave: (p: {
    title: string;
    summary?: string | null;
    description?: string | null;
    assigneeId?: string | null;
    dueAt?: string | null;
    architectUrl?: string | null;
    labelIds?: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [dueAmPm, setDueAmPm] = useState<"AM" | "PM">("AM");
  const [architectUrl, setArchitectUrl] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="modal-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">New task</h3>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-slate-400">
            Title
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Short summary
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_SHORT_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g.\nGoal: finalize brief\n- Sketch option A\n- Client sign-off "
            />
          </label>
          <label className="block text-slate-400">
            Full description
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_LONG_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white"
              rows={12}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Longer checklist, paragraphs, numbered steps...\n\n1. First step\n2. Second step "
            />
          </label>
          {showAssignee ? (
            <label className="block text-slate-400">
              Assignee
              <select
                className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">—</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-slate-400">
            Due date
            <input
              type="date"
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-slate-400">
              Time
              <input
                type="text"
                placeholder="10:00"
                className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </label>
            <label className="block text-slate-400">
              AM / PM
              <select
                className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={dueAmPm}
                onChange={(e) => setDueAmPm(e.target.value as "AM" | "PM")}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </label>
          </div>
          <label className="block text-slate-400">
            Architect / lead URL (integrates with lead nurturing)
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={architectUrl}
              onChange={(e) => setArchitectUrl(e.target.value)}
              placeholder="https://architectdirectory.co.uk/practice/..."
            />
          </label>
          <div>
            <p className="text-slate-400">Labels</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {labels.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={labelIds.includes(l.id)}
                    onChange={(e) => {
                      setLabelIds((prev) =>
                        e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                      );
                    }}
                  />
                  <PlannerLabelChip name={l.name} color={l.color} size="sm" />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!title.trim()) return;
              const dueIso = composeDueAtIso(dueDate, dueTime, dueAmPm);
              await onSave({
                title: title.trim(),
                summary: summary.trim() || null,
                description: description.trim() ? description : null,
                assigneeId: showAssignee ? assigneeId || null : null,
                dueAt: dueIso ? new Date(dueIso).toISOString() : null,
                architectUrl: architectUrl.trim() || null,
                labelIds,
              });
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({
  task,
  labels,
  assignees,
  showAssignee = true,
  readOnly = false,
  footerExtra,
  onClose,
  onSave,
  onDelete,
}: {
  task: TaskRow & { columnId: string };
  labels: Label[];
  assignees: AssigneeOption[];
  showAssignee?: boolean;
  readOnly?: boolean;
  footerExtra?: ReactNode;
  onClose: () => void;
  onSave: (taskId: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const initialDue = splitDueAtIso(task.dueAt);
  const [title, setTitle] = useState(task.title);
  const [summary, setSummary] = useState(task.summary || "");
  const [description, setDescription] = useState(task.description || "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const [dueAmPm, setDueAmPm] = useState<"AM" | "PM">(initialDue.ampm);
  const [architectUrl, setArchitectUrl] = useState(task.architectUrl || "");
  const [labelIds, setLabelIds] = useState(task.labels.map((x) => x.label.id));

  const dueAtDate = task.dueAt ? new Date(task.dueAt) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="modal-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">{readOnly ? "View task" : "Edit task"}</h3>
        {readOnly ? (
          <p className="mt-1 text-xs text-slate-500">This board is read-only. You cannot change fields here.</p>
        ) : null}
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-slate-400">
            Title
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              value={title}
              disabled={readOnly}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Short summary
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_SHORT_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white disabled:opacity-60"
              rows={5}
              value={summary}
              disabled={readOnly}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Full description
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_LONG_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white disabled:opacity-60"
              rows={14}
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {showAssignee ? (
            <label className="block text-slate-400">
              Assignee
              <select
                className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                value={assigneeId}
                disabled={readOnly}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">—</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-slate-400">
            Due date
            <input
              type="date"
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              value={dueDate}
              disabled={readOnly}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-slate-400">
              Time
              <input
                type="text"
                placeholder="10:00"
                className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                value={dueTime}
                disabled={readOnly}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </label>
            <label className="block text-slate-400">
              AM / PM
              <select
                className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                value={dueAmPm}
                disabled={readOnly}
                onChange={(e) => setDueAmPm(e.target.value as "AM" | "PM")}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </label>
          </div>
          <label className="block text-slate-400">
            Architect / lead URL
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              value={architectUrl}
              disabled={readOnly}
              onChange={(e) => setArchitectUrl(e.target.value)}
            />
          </label>
          <div>
            <p className="text-slate-400">Labels</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {labels.map((l) => (
                <label
                  key={l.id}
                  className={`flex items-center gap-1 text-xs ${readOnly ? "cursor-default opacity-80" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={labelIds.includes(l.id)}
                    onChange={(e) => {
                      setLabelIds((prev) =>
                        e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                      );
                    }}
                  />
                  <PlannerLabelChip name={l.name} color={l.color} size="sm" />
                </label>
              ))}
            </div>
          </div>
          {dueAtDate ? (
            <a
              href={googleEventUrl(title, dueAtDate)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-brand-400 hover:underline"
            >
              Open in Google Calendar
            </a>
          ) : null}
        </div>
        {footerExtra}
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          {readOnly ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="text-sm text-red-400 hover:underline"
            >
              Delete task
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm text-slate-500">
              Close
            </button>
            {readOnly ? null : (
              <button
                type="button"
                onClick={async () => {
                  const dueIso = composeDueAtIso(dueDate, dueTime, dueAmPm);
                  await onSave(task.id, {
                    title: title.trim(),
                    summary: summary.trim() || null,
                    description: description.trim() ? description : null,
                    assigneeId: showAssignee ? assigneeId || null : undefined,
                    dueAt: dueIso ? new Date(dueIso).toISOString() : null,
                    architectUrl: architectUrl.trim() || null,
                    labelIds,
                  });
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
