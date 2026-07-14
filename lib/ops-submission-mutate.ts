import type { OpsProjectPhase, OpsTaskType, OpsUrgencyStatus } from "@prisma/client";
import {
  isOpsProjectPhase,
  isOpsTaskType,
  isOpsUrgencyStatus,
} from "@/lib/ops-constants";

export type SubmissionLineItemInput = {
  clientId: string;
  projectId: string | null;
  isHousekeeping: boolean;
  projectPhase: OpsProjectPhase;
  taskType: OpsTaskType;
  taskTypes: string[];
  hoursWorked: number;
  completionPercent?: number | null;
  urgencyStatus?: OpsUrgencyStatus;
  completedSummary?: string | null;
  notes?: string | null;
};

export function parseSubmissionLineItems(raw: unknown): SubmissionLineItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: SubmissionLineItemInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const hoursWorked = Number(o.hoursWorked);
    if (!Number.isFinite(hoursWorked) || hoursWorked <= 0) return null;
    const clientId = String(o.clientId || "").trim();
    if (!clientId) return null;

    const isHousekeeping = Boolean(o.isHousekeeping);
    if (isHousekeeping) {
      const notes = o.notes ? String(o.notes).trim() : "";
      if (!notes) return null;
      items.push({
        clientId,
        projectId: null,
        isHousekeeping: true,
        projectPhase: "housekeeping_internal",
        taskType: "admin_housekeeping",
        taskTypes: ["admin_housekeeping"],
        hoursWorked,
        completionPercent: null,
        urgencyStatus: "normal",
        completedSummary: null,
        notes,
      });
      continue;
    }

    const projectId = String(o.projectId || "").trim();
    if (!projectId) return null;
    const projectPhase = String(o.projectPhase || "");
    if (!isOpsProjectPhase(projectPhase)) return null;
    const rawTypes = Array.isArray(o.taskTypes)
      ? o.taskTypes.map((t) => String(t)).filter((t) => isOpsTaskType(t))
      : [];
    const taskType = rawTypes[0] ?? (isOpsTaskType(String(o.taskType || "")) ? String(o.taskType) : "");
    if (!isOpsTaskType(taskType)) return null;
    const taskTypes = rawTypes.length > 0 ? rawTypes : [taskType];
    const urgency = String(o.urgencyStatus || "normal");
    items.push({
      clientId,
      projectId,
      isHousekeeping: false,
      projectPhase,
      taskType,
      taskTypes,
      hoursWorked,
      completionPercent: o.completionPercent != null ? Number(o.completionPercent) : null,
      urgencyStatus: isOpsUrgencyStatus(urgency) ? urgency : "normal",
      completedSummary: o.completedSummary ? String(o.completedSummary) : null,
      notes: o.notes ? String(o.notes) : null,
    });
  }
  return items;
}
