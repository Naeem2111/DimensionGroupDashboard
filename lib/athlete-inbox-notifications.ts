import { prisma } from "@/lib/prisma";

/** Mark unread task-assigned notifications that deep-link to this inbox task. */
export async function markInboxTaskNotificationsRead(athleteId: string, taskId: string) {
  await prisma.opsAthleteNotification.updateMany({
    where: {
      athleteId,
      readAt: null,
      type: "task_assigned",
      linkPath: { contains: taskId },
    },
    data: { readAt: new Date() },
  });
}
