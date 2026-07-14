/** Daily and monthly hour alert thresholds. */
export const OPS_ALERT_THRESHOLDS = {
  dailyWarningHours: 12,
  dailyCriticalHours: 14,
  monthlyCapDefault: 160,
} as const;

export type OpsAlertSeverity = "info" | "warning" | "critical";

export type OpsAlert = {
  code: string;
  severity: OpsAlertSeverity;
  message: string;
  value?: number;
  threshold?: number;
  linkPath?: string;
};

export function buildDailyHourAlerts(totalHours: number): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  if (totalHours >= OPS_ALERT_THRESHOLDS.dailyCriticalHours) {
    alerts.push({
      code: "daily_14h",
      severity: "critical",
      message: `Daily hours (${totalHours.toFixed(1)}h) exceed the ${OPS_ALERT_THRESHOLDS.dailyCriticalHours}h critical threshold`,
      value: totalHours,
      threshold: OPS_ALERT_THRESHOLDS.dailyCriticalHours,
    });
  } else if (totalHours >= OPS_ALERT_THRESHOLDS.dailyWarningHours) {
    alerts.push({
      code: "daily_12h",
      severity: "warning",
      message: `Daily hours (${totalHours.toFixed(1)}h) exceed the ${OPS_ALERT_THRESHOLDS.dailyWarningHours}h warning threshold`,
      value: totalHours,
      threshold: OPS_ALERT_THRESHOLDS.dailyWarningHours,
    });
  }
  return alerts;
}

export function buildMonthlyCapAlert(monthHours: number, monthlyHourCap: number): OpsAlert | null {
  if (monthHours < monthlyHourCap) return null;
  const severity: OpsAlertSeverity = monthHours > monthlyHourCap ? "critical" : "warning";
  return {
    code: "monthly_cap",
    severity,
    message:
      monthHours > monthlyHourCap
        ? `Monthly hours (${monthHours.toFixed(1)}h) exceed the ${monthlyHourCap}h cap — overtime active`
        : `Monthly hours (${monthHours.toFixed(1)}h) reached the ${monthlyHourCap}h cap`,
    value: monthHours,
    threshold: monthlyHourCap,
  };
}

export function buildBlockerAlert(count: number): OpsAlert | null {
  if (count <= 0) return null;
  return {
    code: "blockers",
    severity: "warning",
    message: `${count} open blocker${count === 1 ? "" : "s"} on your projects`,
    value: count,
  };
}

export function buildCheckInAlert(count: number): OpsAlert | null {
  if (count <= 0) return null;
  return {
    code: "check_in",
    severity: "info",
    message: `${count} check-in request${count === 1 ? "" : "s"} pending`,
    value: count,
  };
}

/** Submissions older than this many calendar days (UTC) are auto-locked. */
export const SUBMISSION_EDIT_GRACE_DAYS = 7;

export function submissionEditCutoffUtc(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - SUBMISSION_EDIT_GRACE_DAYS);
  return d;
}

/** Daily logs are editable by default. Manual lock (ops PATCH) is the only restriction. */
export function isSubmissionEditable(_submissionDate: Date, lockedAt: Date | null): boolean {
  return lockedAt == null;
}
