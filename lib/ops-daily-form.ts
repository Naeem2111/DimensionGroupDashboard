import type { OpsProjectPhase, OpsTaskType } from "@prisma/client";
import { OPS_PROJECT_STAGE_OPTIONS, TASK_TYPE_LABELS } from "@/lib/ops-constants";

/** Daily log phase options — same combined survey/existing stage as operations tracker. */
export const DAILY_PROJECT_PHASE_OPTIONS = OPS_PROJECT_STAGE_OPTIONS;

export const DAILY_TASK_TYPE_OPTIONS = Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({
  value: value as OpsTaskType,
  label,
}));

export function formatTaskTypesDisplay(taskType: string, taskTypes?: string[] | null): string {
  const list =
    taskTypes && taskTypes.length > 0
      ? taskTypes
      : taskType
        ? [taskType]
        : [];
  return list
    .map((t) => TASK_TYPE_LABELS[t as OpsTaskType] ?? t)
    .join(", ");
}
