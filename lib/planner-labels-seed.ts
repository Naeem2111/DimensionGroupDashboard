import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BOARD_LABELS } from "@/lib/planner-default-labels";
import { APPROVED_LABEL_NAMES } from "@/lib/planner-approved-labels";

type Tx = Prisma.TransactionClient;

/** Idempotently ensure standard labels exist on a board. */
export async function ensureDefaultLabelsOnBoard(boardId: string, tx: Tx = prisma) {
  const existing = await tx.plannerLabel.findMany({
    where: { boardId },
    select: { name: true },
  });
  const names = new Set(existing.map((l) => l.name.toLowerCase()));
  const missing = DEFAULT_BOARD_LABELS.filter((l) => !names.has(l.name.toLowerCase()));
  for (const l of missing) {
    await tx.plannerLabel.create({
      data: { boardId, name: l.name, color: l.color },
    });
  }
}

/** Remove legacy labels not in the approved set (15.06 audit). */
export async function purgeUnapprovedBoardLabels(boardId: string, tx: Tx = prisma) {
  const stale = await tx.plannerLabel.findMany({
    where: { boardId, name: { notIn: [...APPROVED_LABEL_NAMES] } },
    select: { id: true },
  });
  if (!stale.length) return;
  const ids = stale.map((l) => l.id);
  await tx.plannerTaskLabel.deleteMany({ where: { labelId: { in: ids } } });
  await tx.plannerLabel.deleteMany({ where: { id: { in: ids } } });
}
