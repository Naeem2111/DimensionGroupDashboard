import type { OpsProjectPhase } from "@prisma/client";
import { displayProjectStageLabel } from "@/lib/ops-constants";

export function projectStageDisplayLabel(stage: OpsProjectPhase): string {
  return displayProjectStageLabel(stage);
}

/** Full title with stage/package — consistent across athlete, admin, archives, and daily logs. */
export function formatProjectFullTitle(name: string, currentStage: OpsProjectPhase): string {
  const stageLabel = displayProjectStageLabel(currentStage);
  const trimmed = name.trim();
  if (!trimmed) return stageLabel;

  const nameLower = trimmed.toLowerCase();
  const stageParts = stageLabel
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (nameLower.includes(stageLabel.toLowerCase())) return trimmed;
  if (stageParts.some((part) => nameLower.includes(part))) return trimmed;

  return `${trimmed} (${stageLabel})`;
}

export function projectDisplayFields(project: { name: string; currentStage: OpsProjectPhase }) {
  const stageLabel = projectStageDisplayLabel(project.currentStage);
  const displayTitle = formatProjectFullTitle(project.name, project.currentStage);
  return { stageLabel, displayTitle };
}
