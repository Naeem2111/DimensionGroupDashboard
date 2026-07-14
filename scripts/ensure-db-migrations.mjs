/**
 * Idempotent pre-push migration for databases copied from Blocharch.
 * Renames legacy enum values / columns so prisma db push can apply the current schema.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function plannerEnumLabels() {
  const rows = await prisma.$queryRaw`
    SELECT e.enumlabel AS label
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PlannerBoardKind'
  `;
  return new Set(rows.map((r) => r.label));
}

async function renameEnumValue(from, to) {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "PlannerBoardKind" RENAME VALUE '${from}' TO '${to}'`
  );
  console.log(`[db-migrate] PlannerBoardKind: ${from} -> ${to}`);
}

async function renameMemberStartColumn() {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ops_athletes'
      AND column_name IN ('blocharch_start_date', 'member_start_date')
  `;
  const names = new Set(rows.map((r) => r.column_name));
  if (names.has("blocharch_start_date") && !names.has("member_start_date")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ops_athletes" RENAME COLUMN "blocharch_start_date" TO "member_start_date"`
    );
    console.log("[db-migrate] ops_athletes.blocharch_start_date -> member_start_date");
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("[db-migrate] DATABASE_URL not set; skipping legacy rename step.");
    return;
  }

  const labels = await plannerEnumLabels();

  if (labels.has("blocharch_outbox") && !labels.has("system_outbox")) {
    await renameEnumValue("blocharch_outbox", "system_outbox");
  }
  if (labels.has("blocharch_inbox") && !labels.has("system_inbox")) {
    await renameEnumValue("blocharch_inbox", "system_inbox");
  }

  await renameMemberStartColumn();
}

main()
  .catch((err) => {
    console.error("[db-migrate] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
