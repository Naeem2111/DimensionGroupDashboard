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
      currentStatus: { notIn: ["completed", "handed_over"] },
    },
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    select: athleteProjectSelect,
  });

  const clients = await prisma.opsClient.findMany({
    where: { projects: { some: { assignedAthleteId: athlete.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    projects: projects.map(serializeProjectForAthlete),
    clients,
  });
}
