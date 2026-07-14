import { PrismaClient } from "@prisma/client";

const logId = process.argv[2] ?? "aa4ade85-2cde-4a15-be50-935abf6745ee";

const prisma = new PrismaClient();

try {
  const log = await prisma.leadOutreachLog.findUnique({
    where: { id: logId },
    include: { lead: { include: { architect: { select: { name: true } } } } },
  });
  if (!log) {
    console.error("Log not found:", logId);
    process.exit(1);
  }

  await prisma.leadOutreachLog.delete({ where: { id: logId } });

  const remaining = await prisma.leadOutreachLog.findMany({
    where: { leadId: log.leadId },
    orderBy: { contactDate: "desc" },
  });

  if (remaining.length === 0) {
    await prisma.lead.update({
      where: { id: log.leadId },
      data: {
        stage: "cold",
        followUpDueAt: null,
        lastContactedAt: null,
        lastEmailedAt: null,
        lastCommunicationType: null,
        touchCount: 0,
        nextAction: null,
        notes: null,
      },
    });
  } else {
    const latest = remaining[0];
    const touchCount = remaining.filter((l) => l.direction === "outbound").length;
    await prisma.lead.update({
      where: { id: log.leadId },
      data: {
        stage: latest.stageAtLog,
        followUpDueAt: latest.followUpDueAt,
        lastContactedAt: latest.contactDate,
        lastCommunicationType: latest.communicationType,
        touchCount,
        nextAction: latest.nextAction,
      },
    });
  }

  console.log("Deleted outreach log for:", log.lead.architect.name);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
