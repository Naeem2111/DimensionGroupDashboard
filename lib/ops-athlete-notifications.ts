import type { OpsAthleteNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createAthleteNotification(input: {
  athleteId: string;
  type: OpsAthleteNotificationType;
  title: string;
  message?: string | null;
  linkPath?: string | null;
}) {
  return prisma.opsAthleteNotification.create({
    data: {
      athleteId: input.athleteId,
      type: input.type,
      title: input.title.slice(0, 200),
      message: input.message?.trim() ?? null,
      linkPath: input.linkPath?.trim() ?? null,
    },
  });
}
