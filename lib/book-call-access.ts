import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { OpsAthlete } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureLinkedAthleteProfile } from "@/lib/ops-athlete-profile";

/** Load slots / read book-call data — athletes only for writes; admin may load manual slots. */
export async function requireBookCallReadAccess(
  request: NextRequest
): Promise<{ user: SessionUser; athlete: OpsAthlete | null } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "athlete_portal")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let athlete = await prisma.opsAthlete.findUnique({ where: { userId: session.user.id } });
  if (!athlete) {
    athlete = await ensureLinkedAthleteProfile(session.user);
  }
  if (!athlete) {
    return NextResponse.json({ error: "No athlete profile linked to this account" }, { status: 404 });
  }
  if (athlete.status !== "active") {
    return NextResponse.json({ error: "Athlete account is inactive" }, { status: 403 });
  }

  return { user: session.user, athlete };
}
