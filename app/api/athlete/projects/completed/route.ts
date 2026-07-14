import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  athleteProjectSelect,
  requireAthletePortalSession,
  serializeProjectForAthlete,
} from "@/lib/ops-access";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const projects = await prisma.opsProject.findMany({
    where: {
      assignedAthleteId: athlete.id,
      currentStatus: { in: ["completed", "handed_over"] },
    },
    orderBy: [{ handoverDate: "desc" }, { updatedAt: "desc" }],
    select: athleteProjectSelect,
  });

  return NextResponse.json({
    projects: projects.map(serializeProjectForAthlete),
  });
}
