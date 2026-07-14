import type { OpsNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createOpsNotification(input: {
  athleteId?: string | null;
  projectId?: string | null;
  type: OpsNotificationType;
  title: string;
  message?: string | null;
  actionRequired?: string | null;
}) {
  return prisma.opsNotification.create({
    data: {
      athleteId: input.athleteId ?? null,
      projectId: input.projectId ?? null,
      type: input.type,
      title: input.title.slice(0, 200),
      message: input.message?.trim() ?? null,
      actionRequired: input.actionRequired?.trim() ?? null,
    },
  });
}
