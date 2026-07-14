import type { OpsAthlete } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

/** Staff roles that get an OpsAthlete profile so they can be assigned to projects. */
const AUTO_LINK_ROLES = new Set<SessionUser["role"]>(["admin"]);

function titleCaseUsername(username: string): string {
  return username
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function resolveUniqueAthleteCode(username: string): Promise<string> {
  const base = username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "STAFF";
  let candidate = base;
  let n = 2;
  while (await prisma.opsAthlete.findUnique({ where: { athleteCode: candidate } })) {
    const suffix = String(n++);
    candidate = `${base.slice(0, Math.max(2, 12 - suffix.length))}${suffix}`;
  }
  return candidate;
}

/** Ensure admin accounts have a linked OpsAthlete row (idempotent). */
export async function ensureLinkedAthleteProfile(user: SessionUser): Promise<OpsAthlete | null> {
  if (!AUTO_LINK_ROLES.has(user.role)) return null;

  const existing = await prisma.opsAthlete.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  const athleteCode = await resolveUniqueAthleteCode(user.username);
  const fullName = titleCaseUsername(user.username);

  return prisma.$transaction(async (tx) => {
    const created = await tx.opsAthlete.create({
      data: {
        userId: user.id,
        fullName,
        athleteCode,
        blocharchStartDate: new Date(),
        status: "active",
      },
    });
    await ensureAthleteSystemBoards(created.id, user.id, tx);
    return created;
  });
}
