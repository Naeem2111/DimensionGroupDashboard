import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlannerSession } from "@/lib/planner-access";

/** Athletes + assignable projects for Outbox form (admin/manager). */
export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [athletes, projects] = await Promise.all([
    prisma.opsAthlete.findMany({
      where: { status: "active" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, athleteCode: true, profilePhotoUrl: true },
    }),
    prisma.opsProject.findMany({
      where: {
        assignedAthleteId: { not: null },
        currentStatus: { notIn: ["completed", "handed_over"] },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        assignedAthleteId: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    athletes,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      assignedAthleteId: p.assignedAthleteId,
    })),
  });
}
