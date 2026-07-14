/** Fixed hex scale for project urgency by days until due (Blocharch palette). */
export function projectDueColor(daysUntilDue: number | null): string {
  if (daysUntilDue == null) return "#64748b";
  if (daysUntilDue < 0) return "#ef4444";
  if (daysUntilDue <= 3) return "#f97316";
  if (daysUntilDue <= 7) return "#eab308";
  if (daysUntilDue <= 14) return "#3b82f6";
  return "#22c55e";
}

export function daysUntilDueFromIso(dueDate: string | null): number | null {
  if (!dueDate?.trim()) return null;
  const dateOnly = dueDate.includes("T") ? dueDate.slice(0, 10) : dueDate.trim();
  const due = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueDay.getTime() - today.getTime()) / 86400000);
}
