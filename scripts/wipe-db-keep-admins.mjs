/**
 * Wipe app data except admin users (role = admin).
 * Usage: node scripts/wipe-db-keep-admins.mjs --confirm
 *        node scripts/wipe-db-keep-admins.mjs --confirm --keep-clients
 *        node scripts/wipe-db-keep-admins.mjs --confirm --keep-practices
 *        node scripts/wipe-db-keep-admins.mjs --confirm --keep-planner
 *   --keep-clients     Skip ops clients, commercial profiles, athletes, and projects.
 *   --keep-practices   Skip architects + marketing leads (practices database).
 *   --keep-planner     Skip planner boards, tasks, columns, and outbox queue.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing to run without --confirm");
    console.error("Example: node scripts/wipe-db-keep-admins.mjs --confirm");
    process.exit(1);
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, username: true, disabled: true },
    orderBy: { createdAt: "asc" },
  });

  if (admins.length === 0) {
    console.error("No admin users found — aborting.");
    process.exit(1);
  }

  console.log("Keeping admin users:");
  for (const a of admins) {
    console.log(`  - ${a.username} (${a.id})${a.disabled ? " [disabled]" : ""}`);
  }

  const counts = {};
  const del = async (key, fn) => {
    counts[key] = (await fn()).count;
    console.log(`  ${key}: ${counts[key]}`);
  };

  const keepClients = process.argv.includes("--keep-clients");
  const keepPractices = process.argv.includes("--keep-practices");
  const keepPlanner = process.argv.includes("--keep-planner");
  if (keepClients) {
    console.log("Keeping ops clients, athletes, and projects (--keep-clients).");
  }
  if (keepPractices) {
    console.log("Keeping marketing practices (--keep-practices).");
  }
  if (keepPlanner) {
    console.log("Keeping planner / Kanban (--keep-planner).");
  }

  console.log("\nDeleting…");
  if (!keepPlanner) {
    await del("plannerTodoItems", () => prisma.plannerTodoItem.deleteMany());
    await del("opsOutboxTasks", () => prisma.opsOutboxTask.deleteMany());
    await del("plannerBoards", () => prisma.plannerBoard.deleteMany());
  }
  await del("opsSubmissionLineItems", () => prisma.opsSubmissionLineItem.deleteMany());
  await del("opsDailySubmissions", () => prisma.opsDailySubmission.deleteMany());
  await del("opsAthleteNotifications", () => prisma.opsAthleteNotification.deleteMany());
  await del("opsCheckInRequests", () => prisma.opsCheckInRequest.deleteMany());
  await del("opsNotifications", () => prisma.opsNotification.deleteMany());
  if (!keepClients) {
    await del("opsProjects", () => prisma.opsProject.deleteMany());
    await del("opsClientCommercial", () => prisma.opsClientCommercialProfile.deleteMany());
    await del("opsClients", () => prisma.opsClient.deleteMany());
    await del("opsAthletes", () => prisma.opsAthlete.deleteMany());
  }
  await del("opsExchangeRates", () => prisma.opsExchangeRate.deleteMany());
  if (!keepPractices) {
    await del("leads", () => prisma.lead.deleteMany());
    await del("architects", () => prisma.architect.deleteMany());
  }
  if (!keepClients) {
    await del("nonAdminUsers", () =>
      prisma.user.deleteMany({ where: { role: { not: "admin" } } })
    );
  }

  console.log("\nDone.");

  const remaining = await prisma.user.findMany({
    select: { username: true, role: true },
    orderBy: { username: "asc" },
  });
  console.log("\nRemaining users:", remaining.length);
  for (const u of remaining) {
    console.log(`  - ${u.username} (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
