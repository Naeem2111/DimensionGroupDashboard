import { labelColor } from "@/lib/planner-approved-labels";

export type DefaultPlannerColumn = {
  title: string;
  color: string;
  sortOrder: number;
  linkedLabelName: string | null;
};

/** Label-aligned workflow columns plus General (default capture) and Done (completion). */
export const DEFAULT_PLANNER_COLUMNS: DefaultPlannerColumn[] = [
  { title: "General", color: "#64748b", sortOrder: 0, linkedLabelName: null },
  {
    title: "This Week",
    color: labelColor("This Week"),
    sortOrder: 1,
    linkedLabelName: "This Week",
  },
  {
    title: "Tomorrow",
    color: labelColor("Tomorrow"),
    sortOrder: 2,
    linkedLabelName: "Tomorrow",
  },
  {
    title: "Urgent",
    color: labelColor("Urgent"),
    sortOrder: 3,
    linkedLabelName: "Urgent",
  },
  {
    title: "Urgent Today",
    color: labelColor("Urgent Today"),
    sortOrder: 4,
    linkedLabelName: "Urgent Today",
  },
  {
    title: "Waiting",
    color: labelColor("Waiting"),
    sortOrder: 5,
    linkedLabelName: "Waiting",
  },
  { title: "Done", color: "#22c55e", sortOrder: 6, linkedLabelName: null },
];

export const GENERAL_COLUMN_TITLES = /^(general|backlog|inbox|todo|to do)\b/i;

export function isGeneralColumnTitle(title: string): boolean {
  return GENERAL_COLUMN_TITLES.test(title.trim());
}

export function resolveGeneralColumnId(columns: { id: string; title: string }[]): string | null {
  const named = columns.find((c) => isGeneralColumnTitle(c.title));
  if (named) return named.id;
  const unlinked = columns.find(
    (c) => !/^(done|completed)\b/i.test(c.title.trim())
  );
  return unlinked?.id ?? columns[0]?.id ?? null;
}
