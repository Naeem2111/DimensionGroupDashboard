import { PrismaClient } from "@prisma/client";
import { syncProjectProgressForProjects } from "../lib/sync-project-progress";

const prisma = new PrismaClient();

/** Survey Conversion project at 86 Bishops Road */
const PROJECT_ID = "8de5f39e-28bd-402e-9f7d-08361b925211";

async function main() {
  const applyCompletion = process.argv.includes("--complete");

  const lineItems = await prisma.opsSubmissionLineItem.findMany({
    where: { projectId: PROJECT_ID },
    include: {
      submission: {
        select: { submissionDate: true, isBackloggedSession: true },
      },
    },
    orderBy: [{ submission: { submissionDate: "asc" } }],
  });

  console.log("=== DAILY LOGS ===");
  for (const li of lineItems) {
    console.log(
      `${li.submission.submissionDate.toISOString().slice(0, 10)} | backlogged=${li.submission.isBackloggedSession} | ${Number(li.hoursWorked)}h | ${li.completionPercent ?? "—"}%`
    );
  }

  if (applyCompletion) {
    const finalLog = lineItems.at(-1);
    if (!finalLog) throw new Error("No line items found");
    if (finalLog.completionPercent === 100) {
      console.log("\nFinal log already at 100% — syncing only.");
    } else {
      console.log(`\nSetting final log (${finalLog.submission.submissionDate.toISOString().slice(0, 10)}) to 100%…`);
      await prisma.opsSubmissionLineItem.update({
        where: { id: finalLog.id },
        data: { completionPercent: 100 },
      });
    }
  }

  await syncProjectProgressForProjects([PROJECT_ID]);

  const after = await prisma.opsProject.findUnique({ where: { id: PROJECT_ID } });
  console.log("\n=== PROJECT AFTER SYNC ===");
  console.log(
    JSON.stringify(
      {
        name: after?.name,
        stage: after?.currentStage,
        status: after?.currentStatus,
        progressPercent: after?.progressPercent,
        dueDate: after?.dueDate?.toISOString().slice(0, 10) ?? null,
        completedAt: after?.completedAt?.toISOString().slice(0, 10) ?? null,
        deadlineBeatenDays: after?.deadlineBeatenDays,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
