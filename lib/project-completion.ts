import { dateOnlyUtc } from "@/lib/ops-hours";

/** Days completed before due date (positive = early). Null if no due date or not early. */
export function computeDeadlineBeatenDays(
  dueDate: Date,
  completedDate: Date
): number | null {
  const due = dateOnlyUtc(dueDate);
  const completed = dateOnlyUtc(completedDate);
  if (completed >= due) return null;
  return Math.ceil((due.getTime() - completed.getTime()) / 86400000);
}

export function projectCompletionDate(now = new Date()): Date {
  return dateOnlyUtc(now);
}
