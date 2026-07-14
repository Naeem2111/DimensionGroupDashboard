import type { LeadStage } from "@/lib/leads";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";

export const LEAD_STAGE_COLORS: Record<LeadStage, string> = {
  cold: "#0ea5e9",
  targeted: "#d946ef",
  first_email_sent: "#6366f1",
  follow_up_due: "#dc2626",
  follow_up_sent: "#f59e0b",
  reply_received: "#14b8a6",
  positive_reply: "#22c55e",
  interested: "#10b981",
  client_onboarded: "#eab308",
  negative_reply: "#ef4444",
  not_interested: "#78716c",
};

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  cold: "Cold",
  targeted: "Targeted",
  first_email_sent: "First email sent",
  follow_up_due: "Follow-up due",
  follow_up_sent: "Follow-up sent",
  reply_received: "Reply received",
  positive_reply: "Positive reply",
  interested: "Interested",
  client_onboarded: "Client onboarded",
  negative_reply: "Negative reply",
  not_interested: "Not interested",
};

export const LEAD_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All leads" },
  { value: "cold", label: "Cold" },
  { value: "targeted", label: "Targeted" },
  { value: "first_email_sent", label: "First email sent" },
  { value: "due_today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "no_reply", label: "No reply" },
  { value: "follow_up_sent", label: "Follow-up sent" },
  { value: "reply_received", label: "Reply received" },
  { value: "positive_reply", label: "Positive reply" },
  { value: "interested", label: "Interested" },
  { value: "client_onboarded", label: "Client onboarded" },
  { value: "negative_reply", label: "Negative reply" },
  { value: "not_interested", label: "Not interested" },
  { value: "follow_up_due", label: "Follow-up due" },
];

export function followUpStatusLabel(status: string): string {
  switch (status) {
    case "due_today":
      return "Due today";
    case "overdue":
      return "Overdue";
    case "scheduled":
      return "Scheduled";
    default:
      return "—";
  }
}

export function followUpStatusColor(status: string): string {
  switch (status) {
    case "due_today":
      return "#f59e0b";
    case "overdue":
      return "#dc2626";
    case "scheduled":
      return "#64748b";
    default:
      return "#64748b";
  }
}

/** Human-readable countdown for a follow-up due date. */
export function formatFollowUpTimeLeft(followUpDueAt?: string | null): string | null {
  const days = daysUntilDueFromIso(followUpDueAt ?? null);
  if (days == null) return null;
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function followUpTimeLeftColor(followUpDueAt?: string | null): string {
  return projectDueColor(daysUntilDueFromIso(followUpDueAt ?? null));
}

/** Text color that reads on solid fill (Gmail label style). */
export function tagTextColorFromBackground(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#ffffff";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1e293b" : "#ffffff";
}
