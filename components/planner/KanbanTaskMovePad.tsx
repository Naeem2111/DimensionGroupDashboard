"use client";

import type { NudgeDirection } from "@/lib/planner-task-nudge";

type KanbanTaskMovePadProps = {
  onNudge: (direction: NudgeDirection) => void;
  canUp?: boolean;
  canDown?: boolean;
  canLeft?: boolean;
  canRight?: boolean;
  /** Compact = icon-only cross; default shows a small D-pad grid. */
  size?: "sm" | "md";
};

function PadButton({
  direction,
  label,
  disabled,
  onClick,
  className = "",
}: {
  direction: NudgeDirection;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const icon =
    direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "left" ? "←" : "→";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`kanban-move-pad-btn flex h-6 w-6 items-center justify-center rounded border text-[11px] font-semibold leading-none transition-colors ${
        disabled
          ? "cursor-not-allowed border-white/[0.04] text-slate-600 opacity-40"
          : "border-white/[0.12] bg-white/[0.06] text-slate-300 hover:border-brand-500/35 hover:bg-brand-500/10 hover:text-brand-200"
      } ${className}`}
    >
      {icon}
    </button>
  );
}

/** D-pad to reorder/move kanban cards without drag-and-drop. */
export function KanbanTaskMovePad({
  onNudge,
  canUp = true,
  canDown = true,
  canLeft = true,
  canRight = true,
  size = "sm",
}: KanbanTaskMovePadProps) {
  const btnSize = size === "md" ? "h-7 w-7 text-xs" : "";

  return (
    <div
      className="kanban-move-pad shrink-0"
      role="group"
      aria-label="Move task"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5">
        <span aria-hidden className="col-start-2 row-start-1">
          <PadButton
            direction="up"
            label="Move up in column"
            disabled={!canUp}
            onClick={() => onNudge("up")}
            className={btnSize}
          />
        </span>
        <span aria-hidden className="col-start-1 row-start-2">
          <PadButton
            direction="left"
            label="Move to previous column"
            disabled={!canLeft}
            onClick={() => onNudge("left")}
            className={btnSize}
          />
        </span>
        <span
          aria-hidden
          className="col-start-2 row-start-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-[8px] uppercase tracking-wide text-slate-600"
        >
          ·
        </span>
        <span aria-hidden className="col-start-3 row-start-2">
          <PadButton
            direction="right"
            label="Move to next column"
            disabled={!canRight}
            onClick={() => onNudge("right")}
            className={btnSize}
          />
        </span>
        <span aria-hidden className="col-start-2 row-start-3">
          <PadButton
            direction="down"
            label="Move down in column"
            disabled={!canDown}
            onClick={() => onNudge("down")}
            className={btnSize}
          />
        </span>
      </div>
    </div>
  );
}
