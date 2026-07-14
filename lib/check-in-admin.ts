import type { OpsCheckInStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOpsNotification } from "@/lib/ops-notifications";

export const PENDING_CHECK_IN_STATUSES: OpsCheckInStatus[] = ["pending", "counter_proposed"];

export const CHECK_IN_NOTIFICATION_REF_PREFIX = "check-in-request:";

export function checkInNotificationRef(requestId: string): string {
  return `${CHECK_IN_NOTIFICATION_REF_PREFIX}${requestId}`;
}

export async function countPendingCheckInRequests(): Promise<number> {
  return prisma.opsCheckInRequest.count({
    where: { status: { in: PENDING_CHECK_IN_STATUSES } },
  });
}

export async function pendingCheckInAthleteIds(): Promise<Set<string>> {
  const rows = await prisma.opsCheckInRequest.findMany({
    where: { status: { in: PENDING_CHECK_IN_STATUSES } },
    select: { athleteId: true },
    distinct: ["athleteId"],
  });
  return new Set(rows.map((r) => r.athleteId));
}

type CheckInNotifyRow = {
  id: string;
  athleteId: string;
  projectId: string | null;
  reason: string;
  source: string;
  athlete: { fullName: string };
  project?: { name: string } | null;
};

export async function notifyOpsCheckInRequest(row: CheckInNotifyRow): Promise<void> {
  const sourceLabel = row.source === "daily_log" ? "Daily Log" : "Book a Call";
  const projectPart = row.project?.name ? ` · ${row.project.name}` : "";
  await createOpsNotification({
    athleteId: row.athleteId,
    projectId: row.projectId,
    type: "check_in_request",
    title: `Check-in request: ${row.athlete.fullName}${projectPart}`,
    message: row.reason,
    actionRequired: `${sourceLabel} — schedule in Check-in requests. Ref: ${checkInNotificationRef(row.id)}`,
  }).catch(() => {});
}

/** Clear admin alerts once a check-in has been scheduled or declined. */
export async function acknowledgeCheckInRequest(
  requestId: string,
  athleteId: string,
  projectId: string | null
): Promise<void> {
  const ref = checkInNotificationRef(requestId);
  await prisma.opsNotification.updateMany({
    where: {
      type: "check_in_request",
      readAt: null,
      actionRequired: { contains: ref },
    },
    data: { readAt: new Date() },
  });

  if (projectId) {
    await prisma.opsProject.updateMany({
      where: { id: projectId, checkInRequested: true },
      data: { checkInRequested: false },
    });
  }

  const stillPending = await prisma.opsCheckInRequest.count({
    where: {
      athleteId,
      status: { in: PENDING_CHECK_IN_STATUSES },
      id: { not: requestId },
    },
  });
  if (stillPending === 0) {
    await prisma.opsProject.updateMany({
      where: { assignedAthleteId: athleteId, checkInRequested: true },
      data: { checkInRequested: false },
    });
  }
}
