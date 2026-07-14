export type ProjectTimeline = {
  daysActive: number | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  label: string;
};

export function computeProjectTimeline(input: {
  startDate: string | null;
  dueDate: string | null;
  handoverDate?: string | null;
}): ProjectTimeline {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parse = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const start = parse(input.startDate);
  const due = parse(input.dueDate ?? input.handoverDate);

  let daysActive: number | null = null;
  if (start) {
    daysActive = Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
  }

  let daysRemaining: number | null = null;
  let isOverdue = false;
  let isDueSoon = false;
  if (due) {
    daysRemaining = Math.round((due.getTime() - today.getTime()) / 86400000);
    isOverdue = daysRemaining < 0;
    isDueSoon = !isOverdue && daysRemaining <= 7;
  }

  let label = "No deadline set";
  if (due) {
    if (isOverdue) {
      label = `${Math.abs(daysRemaining!)} day${Math.abs(daysRemaining!) === 1 ? "" : "s"} overdue`;
    } else if (daysRemaining === 0) {
      label = "Due today";
    } else {
      label = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;
    }
  }

  return { daysActive, daysRemaining, isOverdue, isDueSoon, label };
}
