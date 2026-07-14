/** Only labels allowed per 15.06.2026 audit — used on all planner boards. */
export const APPROVED_PLANNER_LABELS = [
  { name: "This Week", color: "#3b82f6" },
  { name: "Tomorrow", color: "#0ea5e9" },
  { name: "Urgent", color: "#f97316" },
  { name: "Urgent Today", color: "#ef4444" },
  { name: "Waiting", color: "#64748b" },
] as const;

export type ApprovedPlannerLabelName = (typeof APPROVED_PLANNER_LABELS)[number]["name"];

export const APPROVED_LABEL_NAMES = APPROVED_PLANNER_LABELS.map((l) => l.name);

export function isApprovedLabelName(name: string): name is ApprovedPlannerLabelName {
  return APPROVED_LABEL_NAMES.includes(name as ApprovedPlannerLabelName);
}

export function labelColor(name: string): string {
  return APPROVED_PLANNER_LABELS.find((l) => l.name === name)?.color ?? "#64748b";
}
