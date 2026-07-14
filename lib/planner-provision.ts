import { prisma } from "@/lib/prisma";
import { ensureDefaultColumnsOnBoard } from "@/lib/planner-columns-seed";
import { ensureDefaultLabelsOnBoard } from "@/lib/planner-labels-seed";
import { ensureAdminOutboxBoard, ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

/** Backfill fixed boards for existing athletes and admin outbox (idempotent). */
export async function provisionMissingPlannerBoards() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", disabled: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (admin) {
    await ensureAdminOutboxBoard(admin.id);
  }

  const athletes = await prisma.opsAthlete.findMany({
    select: { id: true, userId: true },
  });

  for (const a of athletes) {
    await ensureAthleteSystemBoards(a.id, a.userId);
  }

  const boards = await prisma.plannerBoard.findMany({
    select: { id: true },
  });
  for (const b of boards) {
    await ensureDefaultColumnsOnBoard(b.id);
    await ensureDefaultLabelsOnBoard(b.id);
  }
}
