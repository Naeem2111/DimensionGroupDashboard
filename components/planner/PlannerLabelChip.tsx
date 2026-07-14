import type { CSSProperties } from "react";

export function plannerLabelChipStyle(color: string): CSSProperties {
  const c = color || "#64748b";
  return { ["--label-color" as string]: c };
}

type PlannerLabelChipProps = {
  name: string;
  color: string;
  size?: "xs" | "sm";
  className?: string;
};

/** Task/board label pill — readable in dark and light theme. */
export function PlannerLabelChip({ name, color, size = "xs", className = "" }: PlannerLabelChipProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={`planner-label-chip inline-block max-w-full truncate rounded font-semibold ring-1 ring-inset ${sizeClass} ${className}`}
      style={plannerLabelChipStyle(color)}
      title={name}
    >
      {name}
    </span>
  );
}
