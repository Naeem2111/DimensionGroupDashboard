import type { OpsProjectStatus } from "@prisma/client";

/** Client portal "active" — still in delivery (not fully handed over at 100%). */
export function isClientPortalActiveProject(project: {
  currentStatus: OpsProjectStatus;
  progressPercent: number | null;
}): boolean {
  if (project.currentStatus === "handed_over") return false;
  if (project.progressPercent != null && project.progressPercent >= 100) return false;
  return true;
}

export function isClientPortalCompletedProject(project: {
  currentStatus: OpsProjectStatus;
  progressPercent: number | null;
}): boolean {
  return !isClientPortalActiveProject(project);
}
